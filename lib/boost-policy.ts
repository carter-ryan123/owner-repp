export const BOOST_PLAN = Object.freeze({
  id: 'campus_loop_plus', name: 'Loop Plus', monthlyPriceCents: 500,
  currency: 'usd', interval: 'month', maxFeaturedListings: 3,
});
export function hasBoostAccess(subscription: {status?:string;current_period_end?:number;risk_hold?:number}|null|undefined, now=Date.now()) {
  return !!subscription && subscription.status==='active' && Number(subscription.current_period_end)>now && !subscription.risk_hold;
}
export function isExpectedBoostPrice(price:any) {
  return price?.active===true && price?.currency===BOOST_PLAN.currency && price?.unit_amount===BOOST_PLAN.monthlyPriceCents
    && price?.recurring?.interval===BOOST_PLAN.interval && price?.recurring?.interval_count===1 && !price?.recurring?.usage_type?.includes('metered');
}
export function subscriptionPeriodEnd(subscription:any):number {
  const periods=(subscription?.items?.data||[]).map((i:any)=>Number(i.current_period_end)||0);
  return Math.max(Number(subscription?.current_period_end)||0,...periods,0)*1000;
}
export function orderFinds<T extends {promoted?:number;price:number;created_at:number}>(items:T[],sort:string):T[] {
  return [...items].sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:sort==='recommended'?(Number(b.promoted||0)-Number(a.promoted||0)||b.created_at-a.created_at):b.created_at-a.created_at);
}
