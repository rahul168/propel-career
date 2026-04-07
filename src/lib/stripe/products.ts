export const CREDIT_PACKS = [
  {
    id: "starter",
    credits: 10,
    price: 299,
    label: "Starter",
    priceId: process.env.STRIPE_PRICE_10_CREDITS!,
  },
  {
    id: "pro",
    credits: 20,
    price: 480,
    label: "Pro",
    priceId: process.env.STRIPE_PRICE_20_CREDITS!,
  },
] as const;
