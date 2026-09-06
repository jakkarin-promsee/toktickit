export const CATEGORY_SEEDS = [
  { name: "Account and Access", isActive: true },
  { name: "Hardware", isActive: true },
  { name: "Software", isActive: true },
  { name: "Network", isActive: true },
] as const;

export const RELATED_SYSTEM_SEEDS = [
  { name: "Email", isActive: true },
  { name: "Campus Wi-Fi", isActive: true },
  { name: "VPN", isActive: true },
  { name: "LEB2 App", isActive: true },
  { name: "Grade Submission App", isActive: true },
  { name: "Printer", isActive: true },
  { name: "Corporate Laptop", isActive: true },
] as const;

export const REQUESTER_SEEDS = [
  {
    email: "anan@example.test",
    displayName: "Anan Chai",
    isActive: true,
  },
  {
    email: "mali@example.test",
    displayName: "Mali Srisuk",
    isActive: true,
  },
  {
    email: "niran@example.test",
    displayName: "Niran Boonmee",
    isActive: true,
  },
  {
    email: "pim@example.test",
    displayName: "Pimchanok Dee",
    isActive: true,
  },
  {
    email: "somchai.inactive@example.test",
    displayName: "Somchai Kittipong",
    isActive: false,
  },
] as const;
