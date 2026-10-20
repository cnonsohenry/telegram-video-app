// Helper utilities for high-converting crypto checkouts

export function getNetworkBadge(coinId) {
  const id = String(coinId || "").toLowerCase();
  if (id.includes("usdttrc") || id.includes("trx") || id.includes("tron")) {
    return {
      name: "TRON (TRC-20)",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.12)",
      warning: "Send ONLY USDT via the TRON (TRC-20) network. Sending on other networks will result in lost funds."
    };
  }
  if (id.includes("usdtbsc") || id.includes("bnbbsc") || id.includes("bsc") || id.includes("bep20")) {
    return {
      name: "BNB Smart Chain (BEP-20)",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
      warning: "Send ONLY via the BNB Smart Chain (BEP-20) network."
    };
  }
  if (id.includes("btc") || id.includes("bitcoin")) {
    return {
      name: "Bitcoin Network",
      color: "#f7931a",
      bg: "rgba(247, 147, 26, 0.12)",
      warning: "Send ONLY Bitcoin (BTC) via the Native Bitcoin network."
    };
  }
  if (id.includes("eth") || id.includes("ethereum") || id.includes("erc20")) {
    return {
      name: "Ethereum (ERC-20)",
      color: "#627eea",
      bg: "rgba(98, 126, 234, 0.12)",
      warning: "Send ONLY via the Ethereum (ERC-20) network."
    };
  }
  if (id.includes("ton")) {
    return {
      name: "The Open Network (TON)",
      color: "#0098ea",
      bg: "rgba(0, 152, 234, 0.12)",
      warning: "Send ONLY Toncoin (TON) via The Open Network."
    };
  }
  if (id.includes("ltc") || id.includes("litecoin")) {
    return {
      name: "Litecoin Network",
      color: "#345d9d",
      bg: "rgba(52, 93, 157, 0.12)",
      warning: "Send ONLY Litecoin (LTC) via the Native Litecoin network."
    };
  }
  return {
    name: "Supported Network",
    color: "#a1a1aa",
    bg: "rgba(255, 255, 255, 0.08)",
    warning: "Ensure your wallet matches the selected token and network."
  };
}

export function getWalletDeepLink(coinId, address, amount) {
  if (!address) return "#";
  const id = String(coinId || "").toLowerCase();
  const amt = amount ? String(amount) : "";

  if (id.includes("btc")) {
    return `bitcoin:${address}${amt ? `?amount=${amt}` : ""}`;
  }
  if (id.includes("eth") || id.includes("erc20")) {
    return `ethereum:${address}${amt ? `?value=${amt}` : ""}`;
  }
  if (id.includes("ltc")) {
    return `litecoin:${address}${amt ? `?amount=${amt}` : ""}`;
  }
  if (id.includes("ton")) {
    const nanoTon = Math.round(Number(amt || 0) * 1e9);
    return `ton://transfer/${address}${nanoTon > 0 ? `?amount=${nanoTon}` : ""}`;
  }
  if (id.includes("trc") || id.includes("trx")) {
    return `tron:${address}`;
  }
  if (id.includes("bsc") || id.includes("bep20")) {
    return `ethereum:${address}`;
  }
  return `ethereum:${address}`;
}

export function getQrData(coinId, address, amount) {
  if (!address) return "";
  const id = String(coinId || "").toLowerCase();
  const amt = amount ? String(amount) : "";

  if (id.includes("btc") && amt) {
    return `bitcoin:${address}?amount=${amt}`;
  }
  if (id.includes("eth") && amt) {
    return `ethereum:${address}?value=${amt}`;
  }
  if (id.includes("ltc") && amt) {
    return `litecoin:${address}?amount=${amt}`;
  }
  if (id.includes("ton") && amt) {
    const nanoTon = Math.round(Number(amt || 0) * 1e9);
    return `ton://transfer/${address}${nanoTon > 0 ? `?amount=${nanoTon}` : ""}`;
  }
  return address;
}

export function formatCountdown(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}
