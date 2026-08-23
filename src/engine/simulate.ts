import { MERCHANTS } from "./merchants";
import { cloneAgents } from "./population";
import { u01 } from "./rng";
import type { Agent, HouseholdPath, Macro, MonthPoint, Narrative, Policy, SimResult, Txn } from "./types";
import { NEUTRAL_POLICY } from "./types";

import { COST_OF_FUNDS_SPREAD, DISCOUNT_MONTHLY, INTERCHANGE, RECOVERY } from "./constants";

const NATURAL_U = 0.042;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function emptyMonth(month: number): MonthPoint {
  return {
    month,
    spend: 0,
    spendDisplaced: 0,
    interchange: 0,
    interest: 0,
    fundingCost: 0,
    nim: 0,
    newDefaults: 0,
    defaultRate: 0,
    chargeOffs: 0,
    newChurn: 0,
    churnRate: 0,
    deposits: 0,
    utilization: 0,
    dq30: 0,
    dq90: 0,
    walletShare: 0,
    ltv: 0,
    reward: 0,
    active: 0,
  };
}

function pickMerchant(seed: number, id: number, month: number, k: number) {
  const i = Math.floor(u01(seed, id, month, 40 + k) * MERCHANTS.length);
  return MERCHANTS[Math.min(i, MERCHANTS.length - 1)];
}

export function simulate(args: {
  agents: Agent[];
  months: number;
  macro: Macro;
  policy: Policy;
  seed: number;
}): SimResult {
  const { months, macro, policy, seed } = args;
  const agents = cloneAgents(args.agents);
  const n = agents.length;
  const track = new Set(agents.slice(0, 8).map((a) => a.id));
  const narratives: Narrative[] = [];
  const txns: Txn[] = [];
  const series: MonthPoint[] = [];
  const householdMap = new Map<number, HouseholdPath>();
  const cardSpendByAgent = new Map<number, number>();

  for (const a of agents) {
    if (track.has(a.id)) {
      householdMap.set(a.id, { agent: { ...a }, cash: [], balance: [], spend: [], employed: [] });
    }
    const newLimit = Math.max(250, a.limit * (1 + policy.limitDelta));
    if (policy.limitDelta !== 0 && Math.abs(newLimit - a.limit) > 1 && track.has(a.id) && a.id < 2) {
      narratives.push({
        month: 0,
        agentId: a.id,
        agentName: a.name,
        kind: "limit",
        text: `${a.name}'s line moves ${a.limit.toFixed(0)} → ${newLimit.toFixed(0)} (${Math.round(policy.limitDelta * 100)}%).`,
      });
    }
    a.limit = newLimit;
    a.apr = clamp(a.apr + policy.aprDelta, 0.0799, 0.3599);
    if (policy.cashbackBps > 0) {
      a.walletShare = clamp(a.walletShare + policy.cashbackBps * 0.0009, 0.05, 0.95);
    }
    if (policy.limitDelta < 0) {
      const thin = a.cash / Math.max(1, a.burn) < 1.2;
      a.walletShare = clamp(a.walletShare + (thin ? policy.limitDelta * 0.35 : policy.limitDelta * 0.12), 0.04, 0.95);
    }
  }

  let cumulativeDefaults = 0;
  let cumulativeChurn = 0;
  const startDeposits = agents.reduce((s, a) => s + a.deposits, 0);
  let ltv = 0;
  let txnN = 0;

  for (let m = 0; m < months; m++) {
    const row = emptyMonth(m);
    const infM = macro.inflation / 12;
    const uGap = Math.max(0, macro.unemployment - NATURAL_U);
    const jobLossP = 0.01 + uGap * 0.55;
    const rehireP = 0.18 - uGap * 0.4;

    for (let i = 0; i < n; i++) {
      const a = agents[i];
      const dJob = u01(seed, a.id, m, 1);
      const dRehire = u01(seed, a.id, m, 2);
      const dMed = u01(seed, a.id, m, 3);
      const dSpend = u01(seed, a.id, m, 4);
      const dPay = u01(seed, a.id, m, 5);
      const dChurn = u01(seed, a.id, m, 6);
      const dDefault = u01(seed, a.id, m, 7);
      const dTicket = u01(seed, a.id, m, 8);

      if (a.defaulted || a.churned) {
        a.walletShare *= 0.4;
        row.deposits += a.deposits;
        continue;
      }

      if (a.employed && dJob < jobLossP * (0.6 + a.risk)) {
        a.employed = false;
        a.monthsUnemployed = 0;
        if (track.has(a.id)) {
          narratives.push({
            month: m,
            agentId: a.id,
            agentName: a.name,
            kind: "job_loss",
            text: `${a.name} loses hours in ${a.city}. Income shock on a ${a.segment.replace("_", " ")} book.`,
          });
        }
      } else if (!a.employed && dRehire < Math.max(0.04, rehireP)) {
        a.employed = true;
        a.monthsUnemployed = 0;
        if (track.has(a.id)) {
          narratives.push({
            month: m,
            agentId: a.id,
            agentName: a.name,
            kind: "rehire",
            text: `${a.name} is rehired. Cash buffer rebuilds slowly.`,
          });
        }
      }

      if (!a.employed) a.monthsUnemployed += 1;

      const cola = 1 + infM * 0.4;
      const inflow = a.employed ? a.income * cola : a.income * 0.28;
      const burn = a.burn * (1 + infM * (m + 1));
      const medical = dMed < 0.018 + a.risk * 0.02 ? a.income * (0.15 + 0.4 * dMed) : 0;
      if (medical > 0 && track.has(a.id)) {
        narratives.push({
          month: m,
          agentId: a.id,
          agentName: a.name,
          kind: "medical",
          text: `${a.name} takes a ${Math.round(medical)} medical expense — an exogenous liquidity shock.`,
        });
      }

      a.cash += inflow;
      a.cash -= burn;
      a.cash -= medical;

      const intent = a.habitSpend * a.walletShare * (1 - infM * 2.2) * (0.82 + 0.36 * dSpend);
      const available = Math.max(0, a.limit - a.balance);
      const cashForSpend = Math.max(0, a.cash);
      const capacity = cashForSpend * 0.35 + available;
      let spend = Math.min(Math.max(0, intent), capacity);
      let displaced = Math.max(0, intent - spend);

      if (available < intent * 0.45 && intent > 40) {
        displaced += intent * 0.25;
        spend *= 0.85;
        a.walletShare = clamp(a.walletShare - 0.045, 0.03, 0.95);
        if (track.has(a.id) && displaced > 40) {
          const merch = pickMerchant(seed, a.id, m, 0);
          narratives.push({
            month: m,
            agentId: a.id,
            agentName: a.name,
            kind: "decline",
            text: `Authorization pressure: ${a.name} at ${merch.name} — limit tight, spend routes to a competitor.`,
          });
          txns.push({
            id: `d${txnN++}`,
            month: m,
            day: 4 + Math.floor(dTicket * 22),
            agentId: a.id,
            agentName: a.name,
            merchant: merch.name,
            mcc: merch.mcc,
            category: merch.category,
            amount: Math.round(intent * 0.4 * 100) / 100,
            channel: "decline",
            balanceAfter: a.balance,
            cashAfter: a.cash,
          });
        }
      }

      const onCard = Math.min(spend * (0.55 + 0.35 * a.walletShare), available);
      cardSpendByAgent.set(a.id, (cardSpendByAgent.get(a.id) ?? 0) + onCard);
      const onCash = spend - onCard;
      a.balance += onCard;
      a.cash -= onCash;
      if (a.cash < 0) {
        const revolve = Math.min(-a.cash, Math.max(0, a.limit - a.balance));
        a.balance += revolve;
        a.cash += revolve;
        if (a.cash < 0) {
          a.delinquencyDays += 30;
          a.cash = Math.max(a.cash, -a.burn * 0.25);
        }
      }

      const interest = a.balance * (a.apr / 12);
      a.balance += interest;
      const funding = a.balance * ((macro.fedFunds + COST_OF_FUNDS_SPREAD) / 12);
      const minPay = Math.max(25, a.balance * 0.025);
      const cashMonths = a.cash / Math.max(1, burn);
      let pay = 0;
      if (a.segment === "transactor" && a.cash > a.balance && dPay < 0.9) {
        pay = a.balance;
      } else if (cashMonths > 3) {
        pay = Math.min(a.balance, minPay + a.cash * 0.12);
      } else if (a.cash > minPay) {
        pay = minPay + (dPay * 0.4 * minPay);
      } else {
        pay = Math.max(0, a.cash * 0.5);
        a.delinquencyDays += 30;
      }

      if (policy.hardship && a.delinquencyDays >= 30 && !a.defaulted) {
        pay = Math.min(a.balance, Math.max(pay, minPay * 0.55));
        a.apr = Math.max(0.0799, a.apr * 0.92);
        a.delinquencyDays = Math.max(0, a.delinquencyDays - 15);
        if (track.has(a.id) && m % 4 === 0) {
          narratives.push({
            month: m,
            agentId: a.id,
            agentName: a.name,
            kind: "hardship",
            text: `Hardship plan: ${a.name} gets a restructure before 90-day delinquency.`,
          });
        }
      }

      pay = Math.min(pay, a.balance, Math.max(0, a.cash) + inflow * 0.05);
      a.balance -= pay;
      a.cash -= pay * 0.15;
      if (pay >= minPay * 0.95 && a.cash > burn * 0.2) {
        a.delinquencyDays = Math.max(0, a.delinquencyDays - 30);
      }

      if (a.balance < 5) a.balance = 0;

      const cashback = onCard * (policy.cashbackBps / 10000);
      a.cash += cashback;

      const targetMonths =
        a.segment === "transactor" ? 4.0 : a.segment === "subprime" ? 0.55 : a.segment === "near_prime" ? 1.0 : 1.8;
      const targetCash = burn * targetMonths * (policy.limitDelta < 0 && cashMonths > 1.5 ? 1.12 : 1);
      if (a.cash > targetCash) a.cash -= (a.cash - targetCash) * 0.45;
      const precaution = policy.limitDelta < 0 && cashMonths > 2 ? -policy.limitDelta * 0.03 * a.income : 0;
      const drain = policy.limitDelta < 0 && cashMonths < 1 ? -policy.limitDelta * 0.08 * burn : 0;
      a.deposits = clamp(a.cash * 0.92 + precaution - drain, 0, a.income * 8);
      a.cash = clamp(a.cash, -burn * 0.3, a.income * 10);

      const dqHazard = a.delinquencyDays >= 90
        ? 0.18 + a.risk * 0.35 + (a.employed ? 0 : 0.12) + (policy.limitDelta < 0 && cashMonths < 0.8 ? 0.08 : 0)
        : 0;
      let chargeOff = 0;
      if (dDefault < dqHazard) {
        a.defaulted = true;
        chargeOff = a.balance * (1 - RECOVERY);
        row.newDefaults += 1;
        row.chargeOffs += chargeOff;
        cumulativeDefaults += 1;
        if (track.has(a.id)) {
          narratives.push({
            month: m,
            agentId: a.id,
            agentName: a.name,
            kind: "default",
            text: `${a.name} defaults in month ${m + 1} (${a.delinquencyDays} dpd). Loss ≈ ${Math.round(chargeOff)}.`,
          });
        }
        a.balance = 0;
      }

      const churnP = 0.008 + (0.55 - a.walletShare) * 0.02 + (policy.aprDelta > 0 ? 0.01 : 0) + (displaced > 80 ? 0.015 : 0);
      if (!a.defaulted && dChurn < churnP) {
        a.churned = true;
        cumulativeChurn += 1;
        row.newChurn += 1;
        if (track.has(a.id)) {
          narratives.push({
            month: m,
            agentId: a.id,
            agentName: a.name,
            kind: "churn",
            text: `${a.name} moves top-of-wallet to a competitor after substitution pressure.`,
          });
        }
      }

      const interchange = onCard * INTERCHANGE;
      const nim = interest - funding;
      const reward = nim + interchange - chargeOff - (a.churned ? 45 : 0) - cashback;
      const df = 1 / (1 + DISCOUNT_MONTHLY) ** (m + 1);
      ltv += reward * df;

      row.spend += spend;
      row.spendDisplaced += displaced;
      row.interchange += interchange;
      row.interest += interest;
      row.fundingCost += funding;
      row.nim += nim;
      row.deposits += a.deposits;
      row.utilization += a.limit > 0 ? Math.min(1.2, a.balance / a.limit) : 0;
      row.walletShare += a.walletShare;
      row.reward += reward;
      row.active += 1;
      if (a.delinquencyDays >= 30) row.dq30 += 1;
      if (a.delinquencyDays >= 90) row.dq90 += 1;

      if (track.has(a.id) && spend > 8) {
        const tickets = 1 + Math.floor(dTicket * 3);
        for (let k = 0; k < tickets; k++) {
          const merch = pickMerchant(seed, a.id, m, 3 + k);
          // Size the ticket around the merchant's typical basket rather than
          // splitting the month evenly, so an exported ledger reads like a
          // statement instead of a spreadsheet.
          const jitter = 0.55 + 1.1 * u01(seed, a.id, m, 70 + k);
          const slice = Math.min(spend, Math.max(3, merch.ticket * jitter));
          txns.push({
            id: `t${txnN++}`,
            month: m,
            day: 1 + Math.floor(u01(seed, a.id, m, 50 + k) * 28),
            agentId: a.id,
            agentName: a.name,
            merchant: merch.name,
            mcc: merch.mcc,
            category: merch.category,
            amount: Math.round(slice * 100) / 100,
            channel: "swipe",
            balanceAfter: a.balance,
            cashAfter: a.cash,
          });
        }
        if (pay > 1) {
          txns.push({
            id: `p${txnN++}`,
            month: m,
            day: 22 + Math.floor(dPay * 6),
            agentId: a.id,
            agentName: a.name,
            merchant: "Card payment",
            mcc: "0000",
            category: "payment",
            amount: Math.round(pay * 100) / 100,
            channel: "payment",
            balanceAfter: a.balance,
            cashAfter: a.cash,
          });
        }
      }

      const hp = householdMap.get(a.id);
      if (hp) {
        hp.cash.push(a.cash);
        hp.balance.push(a.balance);
        hp.spend.push(spend);
        hp.employed.push(a.employed);
      }
    }

    const active = Math.max(1, row.active);
    row.defaultRate = cumulativeDefaults / n;
    row.churnRate = cumulativeChurn / n;
    row.utilization /= active;
    row.walletShare /= active;
    row.dq30 /= n;
    row.dq90 /= n;
    row.ltv = ltv / n;
    series.push(row);
  }

  const last = series[series.length - 1] ?? emptyMonth(0);
  const totals = {
    spend: series.reduce((s, r) => s + r.spend, 0),
    displaced: series.reduce((s, r) => s + r.spendDisplaced, 0),
    interchange: series.reduce((s, r) => s + r.interchange, 0),
    nim: series.reduce((s, r) => s + r.nim, 0),
    chargeOffs: series.reduce((s, r) => s + r.chargeOffs, 0),
    defaults: last.defaultRate * n,
    churn: last.churnRate * n,
    ltv: last.ltv * n,
    depositsEnd: last.deposits,
    depositsStart: startDeposits,
    reward: series.reduce((s, r) => s + r.reward, 0),
  };

  txns.sort((a, b) => a.month - b.month || a.day - b.day);
  narratives.sort((a, b) => a.month - b.month);

  return {
    months: series,
    cardSpendByAgent,
    narratives: narratives.slice(0, 48),
    txns: txns.slice(0, 240),
    households: [...householdMap.values()],
    totals,
  };
}

export function runCounterfactual(args: {
  agents: Agent[];
  months: number;
  macro: Macro;
  policy: Policy;
  seed: number;
}): { baseline: SimResult; intervention: SimResult } {
  return {
    baseline: simulate({ ...args, policy: { ...NEUTRAL_POLICY } }),
    intervention: simulate(args),
  };
}
