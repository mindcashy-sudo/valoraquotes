// Safe arithmetic evaluator for `formula_misura`.
// Supports: numbers (Italian comma or dot), + - * / ( ), spaces.
// Returns { value, error }. Never uses eval/Function.

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lp" }
  | { type: "rp" };

function tokenize(input: string): Token[] {
  const s = input.replace(/,/g, ".").trim();
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lp" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rp" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`Numero non valido: ${s.slice(i, j)}`);
      tokens.push({ type: "num", value: n });
      i = j;
      continue;
    }
    throw new Error(`Carattere non valido: '${ch}'`);
  }
  return tokens;
}

// Recursive descent: expr = term (('+'|'-') term)*; term = unary (('*'|'/') unary)*;
// unary = ('-'|'+')? factor; factor = num | '(' expr ')'
function parse(tokens: Token[]): number {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  const factor = (): number => {
    const t = eat();
    if (!t) throw new Error("Espressione incompleta");
    if (t.type === "num") return t.value;
    if (t.type === "lp") {
      const v = expr();
      const r = eat();
      if (!r || r.type !== "rp") throw new Error("Parentesi mancante");
      return v;
    }
    throw new Error("Espressione non valida");
  };

  const unary = (): number => {
    const t = peek();
    if (t && t.type === "op" && (t.value === "-" || t.value === "+")) {
      eat();
      const v = unary();
      return t.value === "-" ? -v : v;
    }
    return factor();
  };

  const term = (): number => {
    let v = unary();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      eat();
      const r = unary();
      if (t.value === "*") v = v * r;
      else {
        if (r === 0) throw new Error("Divisione per zero");
        v = v / r;
      }
    }
    return v;
  };

  const expr = (): number => {
    let v = term();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      eat();
      const r = term();
      v = t.value === "+" ? v + r : v - r;
    }
    return v;
  };

  const v = expr();
  if (pos !== tokens.length) throw new Error("Espressione non valida");
  return v;
}

export function evalFormula(input: string): { value: number | null; error: string | null } {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { value: null, error: null };
  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return { value: null, error: null };
    const v = parse(tokens);
    if (!Number.isFinite(v)) return { value: null, error: "Risultato non valido" };
    // Round to 4 decimals to avoid floating noise.
    return { value: Math.round(v * 10000) / 10000, error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : "Formula non valida" };
  }
}
