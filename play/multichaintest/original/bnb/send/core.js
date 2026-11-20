const sc = "1.2.3";
let $0 = class ra extends Error {
  constructor(t, n = {}) {
    const a = n.cause instanceof ra ? n.cause.details : n.cause?.message ? n.cause.message : n.details, s = n.cause instanceof ra && n.cause.docsPath || n.docsPath, r = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...s ? [`Docs: https://abitype.dev${s}`] : [],
      ...a ? [`Details: ${a}`] : [],
      `Version: abitype@${sc}`
    ].join(`
`);
    super(r), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "AbiTypeError"
    }), n.cause && (this.cause = n.cause), this.details = a, this.docsPath = s, this.metaMessages = n.metaMessages, this.shortMessage = t;
  }
};
function ve(e, t) {
  return e.exec(t)?.groups;
}
const wr = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/, vr = /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/, Tr = /^\(.+?\).*?$/, ss = /^tuple(?<array>(\[(\d*)\])*)$/;
function ia(e) {
  let t = e.type;
  if (ss.test(e.type) && "components" in e) {
    t = "(";
    const n = e.components.length;
    for (let s = 0; s < n; s++) {
      const r = e.components[s];
      t += ia(r), s < n - 1 && (t += ", ");
    }
    const a = ve(ss, e.type);
    return t += `)${a?.array || ""}`, ia({
      ...e,
      type: t
    });
  }
  return "indexed" in e && e.indexed && (t = `${t} indexed`), e.name ? `${t} ${e.name}` : t;
}
function bt(e) {
  let t = "";
  const n = e.length;
  for (let a = 0; a < n; a++) {
    const s = e[a];
    t += ia(s), a !== n - 1 && (t += ", ");
  }
  return t;
}
function rc(e) {
  return e.type === "function" ? `function ${e.name}(${bt(e.inputs)})${e.stateMutability && e.stateMutability !== "nonpayable" ? ` ${e.stateMutability}` : ""}${e.outputs?.length ? ` returns (${bt(e.outputs)})` : ""}` : e.type === "event" ? `event ${e.name}(${bt(e.inputs)})` : e.type === "error" ? `error ${e.name}(${bt(e.inputs)})` : e.type === "constructor" ? `constructor(${bt(e.inputs)})${e.stateMutability === "payable" ? " payable" : ""}` : e.type === "fallback" ? `fallback() external${e.stateMutability === "payable" ? " payable" : ""}` : "receive() external payable";
}
const Ir = /^error (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function ic(e) {
  return Ir.test(e);
}
function oc(e) {
  return ve(Ir, e);
}
const Or = /^event (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function cc(e) {
  return Or.test(e);
}
function dc(e) {
  return ve(Or, e);
}
const Er = /^function (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)(?: (?<scope>external|public{1}))?(?: (?<stateMutability>pure|view|nonpayable|payable{1}))?(?: returns\s?\((?<returns>.*?)\))?$/;
function fc(e) {
  return Er.test(e);
}
function uc(e) {
  return ve(Er, e);
}
const Sr = /^struct (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*) \{(?<properties>.*?)\}$/;
function kr(e) {
  return Sr.test(e);
}
function lc(e) {
  return ve(Sr, e);
}
const Nr = /^constructor\((?<parameters>.*?)\)(?:\s(?<stateMutability>payable{1}))?$/;
function bc(e) {
  return Nr.test(e);
}
function pc(e) {
  return ve(Nr, e);
}
const Cr = /^fallback\(\) external(?:\s(?<stateMutability>payable{1}))?$/;
function mc(e) {
  return Cr.test(e);
}
function gc(e) {
  return ve(Cr, e);
}
const hc = /^receive\(\) external payable$/;
function Ac(e) {
  return hc.test(e);
}
const yc = /* @__PURE__ */ new Set(["indexed"]), oa = /* @__PURE__ */ new Set([
  "calldata",
  "memory",
  "storage"
]);
class wc extends $0 {
  constructor({ type: t }) {
    super("Unknown type.", {
      metaMessages: [
        `Type "${t}" is not a valid ABI type. Perhaps you forgot to include a struct signature?`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownTypeError"
    });
  }
}
class vc extends $0 {
  constructor({ type: t }) {
    super("Unknown type.", {
      metaMessages: [`Type "${t}" is not a valid ABI type.`]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownSolidityTypeError"
    });
  }
}
class Tc extends $0 {
  constructor({ param: t }) {
    super("Invalid ABI parameter.", {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidParameterError"
    });
  }
}
class Ic extends $0 {
  constructor({ param: t, name: n }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `"${n}" is a protected Solidity keyword. More info: https://docs.soliditylang.org/en/latest/cheatsheet.html`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "SolidityProtectedKeywordError"
    });
  }
}
class Oc extends $0 {
  constructor({ param: t, type: n, modifier: a }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `Modifier "${a}" not allowed${n ? ` in "${n}" type` : ""}.`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidModifierError"
    });
  }
}
class Ec extends $0 {
  constructor({ param: t, type: n, modifier: a }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `Modifier "${a}" not allowed${n ? ` in "${n}" type` : ""}.`,
        `Data location can only be specified for array, struct, or mapping types, but "${a}" was given.`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidFunctionModifierError"
    });
  }
}
class Sc extends $0 {
  constructor({ abiParameter: t }) {
    super("Invalid ABI parameter.", {
      details: JSON.stringify(t, null, 2),
      metaMessages: ["ABI parameter type is invalid."]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidAbiTypeParameterError"
    });
  }
}
class ct extends $0 {
  constructor({ signature: t, type: n }) {
    super(`Invalid ${n} signature.`, {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidSignatureError"
    });
  }
}
class kc extends $0 {
  constructor({ signature: t }) {
    super("Unknown signature.", {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownSignatureError"
    });
  }
}
class Nc extends $0 {
  constructor({ signature: t }) {
    super("Invalid struct signature.", {
      details: t,
      metaMessages: ["No properties exist."]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidStructSignatureError"
    });
  }
}
class Cc extends $0 {
  constructor({ type: t }) {
    super("Circular reference detected.", {
      metaMessages: [`Struct "${t}" is a circular reference.`]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "CircularReferenceError"
    });
  }
}
class xc extends $0 {
  constructor({ current: t, depth: n }) {
    super("Unbalanced parentheses.", {
      metaMessages: [
        `"${t.trim()}" has too many ${n > 0 ? "opening" : "closing"} parentheses.`
      ],
      details: `Depth "${n}"`
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidParenthesisError"
    });
  }
}
function _c(e, t, n) {
  let a = "";
  if (n)
    for (const s of Object.entries(n)) {
      if (!s)
        continue;
      let r = "";
      for (const i of s[1])
        r += `[${i.type}${i.name ? `:${i.name}` : ""}]`;
      a += `(${s[0]}{${r}})`;
    }
  return t ? `${t}:${e}${a}` : `${e}${a}`;
}
const Dn = /* @__PURE__ */ new Map([
  // Unnamed
  ["address", { type: "address" }],
  ["bool", { type: "bool" }],
  ["bytes", { type: "bytes" }],
  ["bytes32", { type: "bytes32" }],
  ["int", { type: "int256" }],
  ["int256", { type: "int256" }],
  ["string", { type: "string" }],
  ["uint", { type: "uint256" }],
  ["uint8", { type: "uint8" }],
  ["uint16", { type: "uint16" }],
  ["uint24", { type: "uint24" }],
  ["uint32", { type: "uint32" }],
  ["uint64", { type: "uint64" }],
  ["uint96", { type: "uint96" }],
  ["uint112", { type: "uint112" }],
  ["uint160", { type: "uint160" }],
  ["uint192", { type: "uint192" }],
  ["uint256", { type: "uint256" }],
  // Named
  ["address owner", { type: "address", name: "owner" }],
  ["address to", { type: "address", name: "to" }],
  ["bool approved", { type: "bool", name: "approved" }],
  ["bytes _data", { type: "bytes", name: "_data" }],
  ["bytes data", { type: "bytes", name: "data" }],
  ["bytes signature", { type: "bytes", name: "signature" }],
  ["bytes32 hash", { type: "bytes32", name: "hash" }],
  ["bytes32 r", { type: "bytes32", name: "r" }],
  ["bytes32 root", { type: "bytes32", name: "root" }],
  ["bytes32 s", { type: "bytes32", name: "s" }],
  ["string name", { type: "string", name: "name" }],
  ["string symbol", { type: "string", name: "symbol" }],
  ["string tokenURI", { type: "string", name: "tokenURI" }],
  ["uint tokenId", { type: "uint256", name: "tokenId" }],
  ["uint8 v", { type: "uint8", name: "v" }],
  ["uint256 balance", { type: "uint256", name: "balance" }],
  ["uint256 tokenId", { type: "uint256", name: "tokenId" }],
  ["uint256 value", { type: "uint256", name: "value" }],
  // Indexed
  [
    "event:address indexed from",
    { type: "address", name: "from", indexed: !0 }
  ],
  ["event:address indexed to", { type: "address", name: "to", indexed: !0 }],
  [
    "event:uint indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: !0 }
  ],
  [
    "event:uint256 indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: !0 }
  ]
]);
function Bc(e, t = {}) {
  if (fc(e))
    return jc(e, t);
  if (cc(e))
    return Mc(e, t);
  if (ic(e))
    return Rc(e, t);
  if (bc(e))
    return Dc(e, t);
  if (mc(e))
    return Uc(e);
  if (Ac(e))
    return {
      type: "receive",
      stateMutability: "payable"
    };
  throw new kc({ signature: e });
}
function jc(e, t = {}) {
  const n = uc(e);
  if (!n)
    throw new ct({ signature: e, type: "function" });
  const a = W0(n.parameters), s = [], r = a.length;
  for (let o = 0; o < r; o++)
    s.push(Qe(a[o], {
      modifiers: oa,
      structs: t,
      type: "function"
    }));
  const i = [];
  if (n.returns) {
    const o = W0(n.returns), c = o.length;
    for (let u = 0; u < c; u++)
      i.push(Qe(o[u], {
        modifiers: oa,
        structs: t,
        type: "function"
      }));
  }
  return {
    name: n.name,
    type: "function",
    stateMutability: n.stateMutability ?? "nonpayable",
    inputs: s,
    outputs: i
  };
}
function Mc(e, t = {}) {
  const n = dc(e);
  if (!n)
    throw new ct({ signature: e, type: "event" });
  const a = W0(n.parameters), s = [], r = a.length;
  for (let i = 0; i < r; i++)
    s.push(Qe(a[i], {
      modifiers: yc,
      structs: t,
      type: "event"
    }));
  return { name: n.name, type: "event", inputs: s };
}
function Rc(e, t = {}) {
  const n = oc(e);
  if (!n)
    throw new ct({ signature: e, type: "error" });
  const a = W0(n.parameters), s = [], r = a.length;
  for (let i = 0; i < r; i++)
    s.push(Qe(a[i], { structs: t, type: "error" }));
  return { name: n.name, type: "error", inputs: s };
}
function Dc(e, t = {}) {
  const n = pc(e);
  if (!n)
    throw new ct({ signature: e, type: "constructor" });
  const a = W0(n.parameters), s = [], r = a.length;
  for (let i = 0; i < r; i++)
    s.push(Qe(a[i], { structs: t, type: "constructor" }));
  return {
    type: "constructor",
    stateMutability: n.stateMutability ?? "nonpayable",
    inputs: s
  };
}
function Uc(e) {
  const t = gc(e);
  if (!t)
    throw new ct({ signature: e, type: "fallback" });
  return {
    type: "fallback",
    stateMutability: t.stateMutability ?? "nonpayable"
  };
}
const Pc = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*(?:\spayable)?)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/, Vc = /^\((?<type>.+?)\)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/, Fc = /^u?int$/;
function Qe(e, t) {
  const n = _c(e, t?.type, t?.structs);
  if (Dn.has(n))
    return Dn.get(n);
  const a = Tr.test(e), s = ve(a ? Vc : Pc, e);
  if (!s)
    throw new Tc({ param: e });
  if (s.name && Lc(s.name))
    throw new Ic({ param: e, name: s.name });
  const r = s.name ? { name: s.name } : {}, i = s.modifier === "indexed" ? { indexed: !0 } : {}, o = t?.structs ?? {};
  let c, u = {};
  if (a) {
    c = "tuple";
    const l = W0(s.type), b = [], g = l.length;
    for (let m = 0; m < g; m++)
      b.push(Qe(l[m], { structs: o }));
    u = { components: b };
  } else if (s.type in o)
    c = "tuple", u = { components: o[s.type] };
  else if (Fc.test(s.type))
    c = `${s.type}256`;
  else if (s.type === "address payable")
    c = "address";
  else if (c = s.type, t?.type !== "struct" && !xr(c))
    throw new vc({ type: c });
  if (s.modifier) {
    if (!t?.modifiers?.has?.(s.modifier))
      throw new Oc({
        param: e,
        type: t?.type,
        modifier: s.modifier
      });
    if (oa.has(s.modifier) && !zc(c, !!s.array))
      throw new Ec({
        param: e,
        type: t?.type,
        modifier: s.modifier
      });
  }
  const f = {
    type: `${c}${s.array ?? ""}`,
    ...r,
    ...i,
    ...u
  };
  return Dn.set(n, f), f;
}
function W0(e, t = [], n = "", a = 0) {
  const s = e.trim().length;
  for (let r = 0; r < s; r++) {
    const i = e[r], o = e.slice(r + 1);
    switch (i) {
      case ",":
        return a === 0 ? W0(o, [...t, n.trim()]) : W0(o, t, `${n}${i}`, a);
      case "(":
        return W0(o, t, `${n}${i}`, a + 1);
      case ")":
        return W0(o, t, `${n}${i}`, a - 1);
      default:
        return W0(o, t, `${n}${i}`, a);
    }
  }
  if (n === "")
    return t;
  if (a !== 0)
    throw new xc({ current: n, depth: a });
  return t.push(n.trim()), t;
}
function xr(e) {
  return e === "address" || e === "bool" || e === "function" || e === "string" || wr.test(e) || vr.test(e);
}
const $c = /^(?:after|alias|anonymous|apply|auto|byte|calldata|case|catch|constant|copyof|default|defined|error|event|external|false|final|function|immutable|implements|in|indexed|inline|internal|let|mapping|match|memory|mutable|null|of|override|partial|private|promise|public|pure|reference|relocatable|return|returns|sizeof|static|storage|struct|super|supports|switch|this|true|try|typedef|typeof|var|view|virtual)$/;
function Lc(e) {
  return e === "address" || e === "bool" || e === "function" || e === "string" || e === "tuple" || wr.test(e) || vr.test(e) || $c.test(e);
}
function zc(e, t) {
  return t || e === "bytes" || e === "string" || e === "tuple";
}
function Gc(e) {
  const t = {}, n = e.length;
  for (let i = 0; i < n; i++) {
    const o = e[i];
    if (!kr(o))
      continue;
    const c = lc(o);
    if (!c)
      throw new ct({ signature: o, type: "struct" });
    const u = c.properties.split(";"), f = [], l = u.length;
    for (let b = 0; b < l; b++) {
      const m = u[b].trim();
      if (!m)
        continue;
      const p = Qe(m, {
        type: "struct"
      });
      f.push(p);
    }
    if (!f.length)
      throw new Nc({ signature: o });
    t[c.name] = f;
  }
  const a = {}, s = Object.entries(t), r = s.length;
  for (let i = 0; i < r; i++) {
    const [o, c] = s[i];
    a[o] = _r(c, t);
  }
  return a;
}
const Wc = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?$/;
function _r(e = [], t = {}, n = /* @__PURE__ */ new Set()) {
  const a = [], s = e.length;
  for (let r = 0; r < s; r++) {
    const i = e[r];
    if (Tr.test(i.type))
      a.push(i);
    else {
      const c = ve(Wc, i.type);
      if (!c?.type)
        throw new Sc({ abiParameter: i });
      const { array: u, type: f } = c;
      if (f in t) {
        if (n.has(f))
          throw new Cc({ type: f });
        a.push({
          ...i,
          type: `tuple${u ?? ""}`,
          components: _r(t[f], t, /* @__PURE__ */ new Set([...n, f]))
        });
      } else if (xr(f))
        a.push(i);
      else
        throw new wc({ type: f });
    }
  }
  return a;
}
function dt(e) {
  const t = Gc(e), n = [], a = e.length;
  for (let s = 0; s < a; s++) {
    const r = e[s];
    kr(r) || n.push(Bc(r, t));
  }
  return n;
}
function ca(e, { includeName: t = !1 } = {}) {
  if (e.type !== "function" && e.type !== "event" && e.type !== "error")
    throw new e1(e.type);
  return `${e.name}(${Br(e.inputs, { includeName: t })})`;
}
function Br(e, { includeName: t = !1 } = {}) {
  return e ? e.map((n) => Qc(n, { includeName: t })).join(t ? ", " : ",") : "";
}
function Qc(e, { includeName: t }) {
  return e.type.startsWith("tuple") ? `(${Br(e.components, { includeName: t })})${e.type.slice(5)}` : e.type + (t && e.name ? ` ${e.name}` : "");
}
function jt(e, { strict: t = !0 } = {}) {
  return !e || typeof e != "string" ? !1 : t ? /^0x[0-9a-fA-F]*$/.test(e) : e.startsWith("0x");
}
function V0(e) {
  return jt(e, { strict: !1 }) ? Math.ceil((e.length - 2) / 2) : e.length;
}
const jr = "2.56.3";
let Un = {
  getDocsUrl: ({ docsBaseUrl: e, docsPath: t = "", docsSlug: n }) => t ? `${e ?? "https://viem.sh"}${t}${n ? `#${n}` : ""}` : void 0,
  version: `viem@${jr}`
};
class n0 extends Error {
  constructor(t, n = {}) {
    const a = n.cause instanceof n0 ? n.cause.details : n.cause?.message ? n.cause.message : n.details, s = n.cause instanceof n0 && n.cause.docsPath || n.docsPath, r = Un.getDocsUrl?.({ ...n, docsPath: s }), i = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...r ? [`Docs: ${r}`] : [],
      ...a ? [`Details: ${a}`] : [],
      ...Un.version ? [`Version: ${Un.version}`] : []
    ].join(`
`);
    super(i, n.cause ? { cause: n.cause } : void 0), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "version", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "BaseError"
    }), this.details = a, this.docsPath = s, this.metaMessages = n.metaMessages, this.name = n.name ?? this.name, this.shortMessage = t, this.version = jr;
  }
  walk(t) {
    return Mr(this, t);
  }
}
function Mr(e, t) {
  return t?.(e) ? e : e && typeof e == "object" && "cause" in e && e.cause !== void 0 ? Mr(e.cause, t) : t ? null : e;
}
class Jc extends n0 {
  constructor({ docsPath: t }) {
    super([
      "A constructor was not found on the ABI.",
      "Make sure you are using the correct ABI and that the constructor exists on it."
    ].join(`
`), {
      docsPath: t,
      name: "AbiConstructorNotFoundError"
    });
  }
}
class rs extends n0 {
  constructor({ docsPath: t }) {
    super([
      "Constructor arguments were provided (`args`), but a constructor parameters (`inputs`) were not found on the ABI.",
      "Make sure you are using the correct ABI, and that the `inputs` attribute on the constructor exists."
    ].join(`
`), {
      docsPath: t,
      name: "AbiConstructorParamsNotFoundError"
    });
  }
}
class Yc extends n0 {
  constructor({ expectedLength: t, givenLength: n, type: a }) {
    super([
      `ABI encoding array length mismatch for type ${a}.`,
      `Expected length: ${t}`,
      `Given length: ${n}`
    ].join(`
`), { name: "AbiEncodingArrayLengthMismatchError" });
  }
}
class Zc extends n0 {
  constructor({ expectedSize: t, value: n }) {
    super(`Size of bytes "${n}" (bytes${V0(n)}) does not match expected size (bytes${t}).`, { name: "AbiEncodingBytesSizeMismatchError" });
  }
}
class Rr extends n0 {
  constructor({ expectedLength: t, givenLength: n }) {
    super([
      "ABI encoding params/values length mismatch.",
      `Expected length (params): ${t}`,
      `Given length (values): ${n}`
    ].join(`
`), { name: "AbiEncodingLengthMismatchError" });
  }
}
class is extends n0 {
  constructor(t, { docsPath: n } = {}) {
    super([
      `Function ${t ? `"${t}" ` : ""}not found on ABI.`,
      "Make sure you are using the correct ABI and that the function exists on it."
    ].join(`
`), {
      docsPath: n,
      name: "AbiFunctionNotFoundError"
    });
  }
}
class qc extends n0 {
  constructor(t, n) {
    super("Found ambiguous types in overloaded ABI items.", {
      metaMessages: [
        `\`${t.type}\` in \`${ca(t.abiItem)}\`, and`,
        `\`${n.type}\` in \`${ca(n.abiItem)}\``,
        "",
        "These types encode differently and cannot be distinguished at runtime.",
        "Remove one of the ambiguous items in the ABI."
      ],
      name: "AbiItemAmbiguityError"
    });
  }
}
class Hc extends n0 {
  constructor({ expectedSize: t, givenSize: n }) {
    super(`Expected bytes${t}, got bytes${n}.`, {
      name: "BytesSizeMismatchError"
    });
  }
}
class Xc extends n0 {
  constructor(t, { docsPath: n }) {
    super([
      `Type "${t}" is not a valid encoding type.`,
      "Please provide a valid ABI type."
    ].join(`
`), { docsPath: n, name: "InvalidAbiEncodingType" });
  }
}
class Kc extends n0 {
  constructor(t) {
    super([`Value "${t}" is not a valid array.`].join(`
`), {
      name: "InvalidArrayError"
    });
  }
}
class e1 extends n0 {
  constructor(t) {
    super([
      `"${t}" is not a valid definition type.`,
      'Valid types: "function", "event", "error"'
    ].join(`
`), { name: "InvalidDefinitionTypeError" });
  }
}
class t1 extends n0 {
  constructor(t) {
    super(`Type "${t}" is not supported for packed encoding.`, {
      name: "UnsupportedPackedAbiType"
    });
  }
}
class Dr extends n0 {
  constructor({ offset: t, position: n, size: a }) {
    super(`Slice ${n === "start" ? "starting" : "ending"} at offset "${t}" is out-of-bounds (size: ${a}).`, { name: "SliceOffsetOutOfBoundsError" });
  }
}
class Ur extends n0 {
  constructor({ size: t, targetSize: n, type: a }) {
    super(`${a.charAt(0).toUpperCase()}${a.slice(1).toLowerCase()} size (${t}) exceeds padding size (${n}).`, { name: "SizeExceedsPaddingSizeError" });
  }
}
function he(e, { dir: t, size: n = 32 } = {}) {
  return typeof e == "string" ? ee(e, { dir: t, size: n }) : n1(e, { dir: t, size: n });
}
function ee(e, { dir: t, size: n = 32 } = {}) {
  if (n === null)
    return e;
  const a = e.replace("0x", "");
  if (a.length > n * 2)
    throw new Ur({
      size: Math.ceil(a.length / 2),
      targetSize: n,
      type: "hex"
    });
  return `0x${a[t === "right" ? "padEnd" : "padStart"](n * 2, "0")}`;
}
function n1(e, { dir: t, size: n = 32 } = {}) {
  if (n === null)
    return e;
  if (e.length > n)
    throw new Ur({
      size: e.length,
      targetSize: n,
      type: "bytes"
    });
  const a = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    const r = t === "right";
    a[r ? s : n - s - 1] = e[r ? s : e.length - s - 1];
  }
  return a;
}
class Pr extends n0 {
  constructor({ max: t, min: n, signed: a, size: s, value: r }) {
    super(`Number "${r}" is not in safe ${s ? `${s * 8}-bit ${a ? "signed" : "unsigned"} ` : ""}integer range ${t ? `(${n} to ${t})` : `(above ${n})`}`, { name: "IntegerOutOfRangeError" });
  }
}
class a1 extends n0 {
  constructor({ givenSize: t, maxSize: n }) {
    super(`Size cannot exceed ${n} bytes. Given size: ${t} bytes.`, { name: "SizeOverflowError" });
  }
}
function Mt(e, { size: t }) {
  if (V0(e) > t)
    throw new a1({
      givenSize: V0(e),
      maxSize: t
    });
}
const s1 = /* @__PURE__ */ Array.from({ length: 256 }, (e, t) => t.toString(16).padStart(2, "0"));
function R0(e, t = {}) {
  return typeof e == "number" || typeof e == "bigint" ? Re(e, t) : typeof e == "string" ? xa(e, t) : typeof e == "boolean" ? Ca(e, t) : Vr(e, t);
}
function Ca(e, t = {}) {
  const n = `0x${Number(e)}`;
  return typeof t.size == "number" ? (Mt(n, { size: t.size }), he(n, { size: t.size })) : n;
}
function Vr(e, t = {}) {
  let n = "";
  for (let s = 0; s < e.length; s++)
    n += s1[e[s]];
  const a = `0x${n}`;
  return typeof t.size == "number" ? (Mt(a, { size: t.size }), he(a, { dir: "right", size: t.size })) : a;
}
function Re(e, t = {}) {
  const { signed: n, size: a } = t, s = BigInt(e);
  let r;
  a ? n ? r = (1n << BigInt(a) * 8n - 1n) - 1n : r = 2n ** (BigInt(a) * 8n) - 1n : typeof e == "number" && (r = BigInt(Number.MAX_SAFE_INTEGER));
  const i = typeof r == "bigint" && n ? -r - 1n : 0;
  if (r && s > r || s < i) {
    const c = typeof e == "bigint" ? "n" : "";
    throw new Pr({
      max: r ? `${r}${c}` : void 0,
      min: `${i}${c}`,
      signed: n,
      size: a,
      value: `${e}${c}`
    });
  }
  const o = `0x${(n && s < 0 ? (1n << BigInt(a * 8)) + BigInt(s) : s).toString(16)}`;
  return a ? he(o, { size: a }) : o;
}
const r1 = /* @__PURE__ */ new TextEncoder();
function xa(e, t = {}) {
  const n = r1.encode(e);
  return Vr(n, t);
}
const i1 = /* @__PURE__ */ new TextEncoder();
function Fr(e, t = {}) {
  return typeof e == "number" || typeof e == "bigint" ? c1(e, t) : typeof e == "boolean" ? o1(e, t) : jt(e) ? $r(e, t) : Lr(e, t);
}
function o1(e, t = {}) {
  const n = new Uint8Array(1);
  return n[0] = Number(e), typeof t.size == "number" ? (Mt(n, { size: t.size }), he(n, { size: t.size })) : n;
}
const ie = {
  zero: 48,
  nine: 57,
  A: 65,
  F: 70,
  a: 97,
  f: 102
};
function os(e) {
  if (e >= ie.zero && e <= ie.nine)
    return e - ie.zero;
  if (e >= ie.A && e <= ie.F)
    return e - (ie.A - 10);
  if (e >= ie.a && e <= ie.f)
    return e - (ie.a - 10);
}
function $r(e, t = {}) {
  let n = e;
  t.size && (Mt(n, { size: t.size }), n = he(n, { dir: "right", size: t.size }));
  let a = n.slice(2);
  a.length % 2 && (a = `0${a}`);
  const s = a.length / 2, r = new Uint8Array(s);
  for (let i = 0, o = 0; i < s; i++) {
    const c = os(a.charCodeAt(o++)), u = os(a.charCodeAt(o++));
    if (c === void 0 || u === void 0)
      throw new n0(`Invalid byte sequence ("${a[o - 2]}${a[o - 1]}" in "${a}").`);
    r[i] = c * 16 + u;
  }
  return r;
}
function c1(e, t) {
  const n = Re(e, t);
  return $r(n);
}
function Lr(e, t = {}) {
  const n = i1.encode(e);
  return typeof t.size == "number" ? (Mt(n, { size: t.size }), he(n, { dir: "right", size: t.size })) : n;
}
const Lt = /* @__PURE__ */ BigInt(2 ** 32 - 1), cs = /* @__PURE__ */ BigInt(32);
function d1(e, t = !1) {
  return t ? { h: Number(e & Lt), l: Number(e >> cs & Lt) } : { h: Number(e >> cs & Lt) | 0, l: Number(e & Lt) | 0 };
}
function f1(e, t = !1) {
  const n = e.length;
  let a = new Uint32Array(n), s = new Uint32Array(n);
  for (let r = 0; r < n; r++) {
    const { h: i, l: o } = d1(e[r], t);
    [a[r], s[r]] = [i, o];
  }
  return [a, s];
}
const u1 = (e, t, n) => e << n | t >>> 32 - n, l1 = (e, t, n) => t << n | e >>> 32 - n, b1 = (e, t, n) => t << n - 32 | e >>> 64 - n, p1 = (e, t, n) => e << n - 32 | t >>> 64 - n;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function m1(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array";
}
function ds(e) {
  if (!Number.isSafeInteger(e) || e < 0)
    throw new Error("positive integer expected, got " + e);
}
function rn(e, ...t) {
  if (!m1(e))
    throw new Error("Uint8Array expected");
  if (t.length > 0 && !t.includes(e.length))
    throw new Error("Uint8Array expected of length " + t + ", got length=" + e.length);
}
function fs(e, t = !0) {
  if (e.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (t && e.finished)
    throw new Error("Hash#digest() has already been called");
}
function g1(e, t) {
  rn(e);
  const n = t.outputLen;
  if (e.length < n)
    throw new Error("digestInto() expects output buffer of length at least " + n);
}
function h1(e) {
  return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function zr(...e) {
  for (let t = 0; t < e.length; t++)
    e[t].fill(0);
}
const A1 = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function y1(e) {
  return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
function w1(e) {
  for (let t = 0; t < e.length; t++)
    e[t] = y1(e[t]);
  return e;
}
const us = A1 ? (e) => e : w1;
function v1(e) {
  if (typeof e != "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(e));
}
function Gr(e) {
  return typeof e == "string" && (e = v1(e)), rn(e), e;
}
class T1 {
}
function I1(e) {
  const t = (a) => e().update(Gr(a)).digest(), n = e();
  return t.outputLen = n.outputLen, t.blockLen = n.blockLen, t.create = () => e(), t;
}
const O1 = BigInt(0), pt = BigInt(1), E1 = BigInt(2), S1 = BigInt(7), k1 = BigInt(256), N1 = BigInt(113), Wr = [], Qr = [], Jr = [];
for (let e = 0, t = pt, n = 1, a = 0; e < 24; e++) {
  [n, a] = [a, (2 * n + 3 * a) % 5], Wr.push(2 * (5 * a + n)), Qr.push((e + 1) * (e + 2) / 2 % 64);
  let s = O1;
  for (let r = 0; r < 7; r++)
    t = (t << pt ^ (t >> S1) * N1) % k1, t & E1 && (s ^= pt << (pt << /* @__PURE__ */ BigInt(r)) - pt);
  Jr.push(s);
}
const Yr = f1(Jr, !0), C1 = Yr[0], x1 = Yr[1], ls = (e, t, n) => n > 32 ? b1(e, t, n) : u1(e, t, n), bs = (e, t, n) => n > 32 ? p1(e, t, n) : l1(e, t, n);
function _1(e, t = 24) {
  const n = new Uint32Array(10);
  for (let a = 24 - t; a < 24; a++) {
    for (let i = 0; i < 10; i++)
      n[i] = e[i] ^ e[i + 10] ^ e[i + 20] ^ e[i + 30] ^ e[i + 40];
    for (let i = 0; i < 10; i += 2) {
      const o = (i + 8) % 10, c = (i + 2) % 10, u = n[c], f = n[c + 1], l = ls(u, f, 1) ^ n[o], b = bs(u, f, 1) ^ n[o + 1];
      for (let g = 0; g < 50; g += 10)
        e[i + g] ^= l, e[i + g + 1] ^= b;
    }
    let s = e[2], r = e[3];
    for (let i = 0; i < 24; i++) {
      const o = Qr[i], c = ls(s, r, o), u = bs(s, r, o), f = Wr[i];
      s = e[f], r = e[f + 1], e[f] = c, e[f + 1] = u;
    }
    for (let i = 0; i < 50; i += 10) {
      for (let o = 0; o < 10; o++)
        n[o] = e[i + o];
      for (let o = 0; o < 10; o++)
        e[i + o] ^= ~n[(o + 2) % 10] & n[(o + 4) % 10];
    }
    e[0] ^= C1[a], e[1] ^= x1[a];
  }
  zr(n);
}
class _a extends T1 {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(t, n, a, s = !1, r = 24) {
    if (super(), this.pos = 0, this.posOut = 0, this.finished = !1, this.destroyed = !1, this.enableXOF = !1, this.blockLen = t, this.suffix = n, this.outputLen = a, this.enableXOF = s, this.rounds = r, ds(a), !(0 < t && t < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200), this.state32 = h1(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    us(this.state32), _1(this.state32, this.rounds), us(this.state32), this.posOut = 0, this.pos = 0;
  }
  update(t) {
    fs(this), t = Gr(t), rn(t);
    const { blockLen: n, state: a } = this, s = t.length;
    for (let r = 0; r < s; ) {
      const i = Math.min(n - this.pos, s - r);
      for (let o = 0; o < i; o++)
        a[this.pos++] ^= t[r++];
      this.pos === n && this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = !0;
    const { state: t, suffix: n, pos: a, blockLen: s } = this;
    t[a] ^= n, n & 128 && a === s - 1 && this.keccak(), t[s - 1] ^= 128, this.keccak();
  }
  writeInto(t) {
    fs(this, !1), rn(t), this.finish();
    const n = this.state, { blockLen: a } = this;
    for (let s = 0, r = t.length; s < r; ) {
      this.posOut >= a && this.keccak();
      const i = Math.min(a - this.posOut, r - s);
      t.set(n.subarray(this.posOut, this.posOut + i), s), this.posOut += i, s += i;
    }
    return t;
  }
  xofInto(t) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(t);
  }
  xof(t) {
    return ds(t), this.xofInto(new Uint8Array(t));
  }
  digestInto(t) {
    if (g1(t, this), this.finished)
      throw new Error("digest() was already called");
    return this.writeInto(t), this.destroy(), t;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = !0, zr(this.state);
  }
  _cloneInto(t) {
    const { blockLen: n, suffix: a, outputLen: s, rounds: r, enableXOF: i } = this;
    return t || (t = new _a(n, a, s, i, r)), t.state32.set(this.state32), t.pos = this.pos, t.posOut = this.posOut, t.finished = this.finished, t.rounds = r, t.suffix = a, t.outputLen = s, t.enableXOF = i, t.destroyed = this.destroyed, t;
  }
}
const B1 = (e, t, n) => I1(() => new _a(t, e, n)), j1 = B1(1, 136, 256 / 8);
function ae(e, t) {
  const n = t || "hex", a = j1(jt(e, { strict: !1 }) ? Fr(e) : e);
  return n === "bytes" ? a : R0(a);
}
const M1 = (e) => ae(Fr(e));
function R1(e) {
  return M1(e);
}
function D1(e) {
  let t = !0, n = "", a = 0, s = "", r = !1;
  for (let i = 0; i < e.length; i++) {
    const o = e[i];
    if (["(", ")", ","].includes(o) && (t = !0), o === "(" && a++, o === ")" && a--, !!t) {
      if (a === 0) {
        if (o === " " && ["event", "function", ""].includes(s))
          s = "";
        else if (s += o, o === ")") {
          r = !0;
          break;
        }
        continue;
      }
      if (o === " ") {
        e[i - 1] !== "," && n !== "," && n !== ",(" && (n = "", t = !1);
        continue;
      }
      s += o, n += o;
    }
  }
  if (!r)
    throw new n0("Unable to normalize signature.");
  return s;
}
const U1 = (e) => {
  const t = typeof e == "string" ? e : rc(e);
  return D1(t);
};
function Zr(e) {
  return R1(U1(e));
}
const P1 = Zr;
class qr extends n0 {
  constructor({ address: t }) {
    super(`Address "${t}" is invalid.`, {
      metaMessages: [
        "- Address must be a hex value of 20 bytes (40 hex characters).",
        "- Address must match its checksum counterpart."
      ],
      name: "InvalidAddressError"
    });
  }
}
class Hr extends Map {
  constructor(t) {
    super(), Object.defineProperty(this, "maxSize", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.maxSize = t;
  }
  get(t) {
    const n = super.get(t);
    return super.has(t) && (super.delete(t), super.set(t, n)), n;
  }
  set(t, n) {
    if (super.has(t) && super.delete(t), super.set(t, n), this.maxSize && this.size > this.maxSize) {
      const a = super.keys().next().value;
      a !== void 0 && super.delete(a);
    }
    return this;
  }
}
const Pn = /* @__PURE__ */ new Hr(8192);
function V1(e, t) {
  if (Pn.has(`${e}.${t}`))
    return Pn.get(`${e}.${t}`);
  const n = e.substring(2).toLowerCase(), a = ae(Lr(n), "bytes"), s = n.split("");
  for (let i = 0; i < 40; i += 2)
    a[i >> 1] >> 4 >= 8 && s[i] && (s[i] = s[i].toUpperCase()), (a[i >> 1] & 15) >= 8 && s[i + 1] && (s[i + 1] = s[i + 1].toUpperCase());
  const r = `0x${s.join("")}`;
  return Pn.set(`${e}.${t}`, r), r;
}
const F1 = /^0x[a-fA-F0-9]{40}$/, Vn = /* @__PURE__ */ new Hr(8192);
function St(e, t) {
  const { strict: n = !0 } = t ?? {}, a = `${e}.${n}`;
  if (Vn.has(a))
    return Vn.get(a);
  const s = F1.test(e) ? e.toLowerCase() === e ? !0 : n ? V1(e) === e : !0 : !1;
  return Vn.set(a, s), s;
}
function D0(e) {
  return `0x${e.reduce((t, n) => t + n.replace("0x", ""), "")}`;
}
function Xr(e, t, n, { strict: a } = {}) {
  return jt(e, { strict: !1 }) ? L1(e, t, n, {
    strict: a
  }) : $1(e, t, n, {
    strict: a
  });
}
function Kr(e, t) {
  if (typeof t == "number" && t > 0 && t > V0(e) - 1)
    throw new Dr({
      offset: t,
      position: "start",
      size: V0(e)
    });
}
function ei(e, t, n) {
  if (typeof t == "number" && typeof n == "number" && V0(e) !== n - t)
    throw new Dr({
      offset: n,
      position: "end",
      size: V0(e)
    });
}
function $1(e, t, n, { strict: a } = {}) {
  Kr(e, t);
  const s = e.slice(t, n);
  return a && ei(s, t, n), s;
}
function L1(e, t, n, { strict: a } = {}) {
  Kr(e, t);
  const s = `0x${e.replace("0x", "").slice((t ?? 0) * 2, (n ?? e.length) * 2)}`;
  return a && ei(s, t, n), s;
}
const z1 = /^(.*)\[([0-9]*)\]$/, G1 = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/, ti = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
function st(e, t) {
  if (e.length !== t.length)
    throw new Rr({
      expectedLength: e.length,
      givenLength: t.length
    });
  const n = W1({
    params: e,
    values: t
  });
  return ja(n);
}
function W1({ params: e, values: t }) {
  const n = [];
  for (let a = 0; a < e.length; a++)
    n.push(Ba({ param: e[a], value: t[a] }));
  return n;
}
function Ba({ param: e, value: t }) {
  const n = ni(e.type);
  if (n) {
    const [a, s] = n;
    return J1(t, { length: a, param: { ...e, type: s } });
  }
  if (e.type === "tuple")
    return X1(t, {
      param: e
    });
  if (e.type === "address")
    return Q1(t);
  if (e.type === "bool")
    return Z1(t);
  if (e.type.startsWith("uint") || e.type.startsWith("int")) {
    const a = e.type.startsWith("int"), [, , s = "256"] = ti.exec(e.type) ?? [];
    return q1(t, {
      signed: a,
      size: Number(s)
    });
  }
  if (e.type.startsWith("bytes"))
    return Y1(t, { param: e });
  if (e.type === "string")
    return H1(t);
  throw new Xc(e.type, {
    docsPath: "/docs/contract/encodeAbiParameters"
  });
}
function ja(e) {
  let t = 0;
  for (let r = 0; r < e.length; r++) {
    const { dynamic: i, encoded: o } = e[r];
    i ? t += 32 : t += V0(o);
  }
  const n = [], a = [];
  let s = 0;
  for (let r = 0; r < e.length; r++) {
    const { dynamic: i, encoded: o } = e[r];
    i ? (n.push(Re(t + s, { size: 32 })), a.push(o), s += V0(o)) : n.push(o);
  }
  return D0([...n, ...a]);
}
function Q1(e) {
  if (!St(e))
    throw new qr({ address: e });
  return { dynamic: !1, encoded: ee(e.toLowerCase()) };
}
function J1(e, { length: t, param: n }) {
  const a = t === null;
  if (!Array.isArray(e))
    throw new Kc(e);
  if (!a && e.length !== t)
    throw new Yc({
      expectedLength: t,
      givenLength: e.length,
      type: `${n.type}[${t}]`
    });
  let s = e.length === 0 && da(n);
  const r = [];
  for (let i = 0; i < e.length; i++) {
    const o = Ba({ param: n, value: e[i] });
    o.dynamic && (s = !0), r.push(o);
  }
  if (a || s) {
    const i = ja(r);
    if (a) {
      const o = Re(r.length, { size: 32 });
      return {
        dynamic: !0,
        encoded: D0([o, i])
      };
    }
    if (s)
      return { dynamic: !0, encoded: i };
  }
  return {
    dynamic: !1,
    encoded: D0(r.map(({ encoded: i }) => i))
  };
}
function Y1(e, { param: t }) {
  const [, n] = t.type.split("bytes"), a = V0(e);
  if (!n) {
    let s = e;
    return a % 32 !== 0 && (s = ee(s, {
      dir: "right",
      size: Math.ceil((e.length - 2) / 2 / 32) * 32
    })), {
      dynamic: !0,
      encoded: D0([
        ee(Re(a, { size: 32 })),
        s
      ])
    };
  }
  if (a !== Number.parseInt(n, 10))
    throw new Zc({
      expectedSize: Number.parseInt(n, 10),
      value: e
    });
  return { dynamic: !1, encoded: ee(e, { dir: "right" }) };
}
function Z1(e) {
  if (typeof e != "boolean")
    throw new n0(`Invalid boolean value: "${e}" (type: ${typeof e}). Expected: \`true\` or \`false\`.`);
  return { dynamic: !1, encoded: ee(Ca(e)) };
}
function q1(e, { signed: t, size: n = 256 }) {
  if (typeof n == "number") {
    const a = 2n ** (BigInt(n) - (t ? 1n : 0n)) - 1n, s = t ? -a - 1n : 0n;
    if (e > a || e < s)
      throw new Pr({
        max: a.toString(),
        min: s.toString(),
        signed: t,
        size: n / 8,
        value: e.toString()
      });
  }
  return {
    dynamic: !1,
    encoded: Re(e, {
      size: 32,
      signed: t
    })
  };
}
function H1(e) {
  const t = xa(e), n = Math.ceil(V0(t) / 32), a = [];
  for (let s = 0; s < n; s++)
    a.push(ee(Xr(t, s * 32, (s + 1) * 32), {
      dir: "right"
    }));
  return {
    dynamic: !0,
    encoded: D0([
      ee(Re(V0(t), { size: 32 })),
      ...a
    ])
  };
}
function X1(e, { param: t }) {
  let n = !1;
  const a = [];
  for (let s = 0; s < t.components.length; s++) {
    const r = t.components[s], i = Array.isArray(e) ? s : r.name, o = Ba({
      param: r,
      value: e[i]
    });
    a.push(o), o.dynamic && (n = !0);
  }
  return {
    dynamic: n,
    encoded: n ? ja(a) : D0(a.map(({ encoded: s }) => s))
  };
}
function ni(e) {
  const t = e.match(/^(.*)\[(\d+)?\]$/);
  return t ? (
    // Return `null` if the array is dynamic.
    [t[2] ? Number(t[2]) : null, t[1]]
  ) : void 0;
}
function da(e) {
  const { type: t } = e;
  if (t === "string" || t === "bytes" || t.endsWith("[]"))
    return !0;
  if (t === "tuple")
    return e.components.some(da);
  const n = ni(t);
  return n ? da({ ...e, type: n[1] }) : !1;
}
const ai = (e) => Xr(Zr(e), 0, 4);
function K1(e) {
  const { abi: t, args: n = [], name: a } = e, s = jt(a, { strict: !1 }), r = t.filter((o) => s ? o.type === "function" ? ai(o) === a : o.type === "event" ? P1(o) === a : !1 : "name" in o && o.name === a);
  if (r.length === 0)
    return;
  if (r.length === 1)
    return r[0];
  let i;
  for (const o of r) {
    if (!("inputs" in o))
      continue;
    if (!n || n.length === 0) {
      if (!o.inputs || o.inputs.length === 0)
        return o;
      continue;
    }
    if (!o.inputs || o.inputs.length === 0 || o.inputs.length !== n.length)
      continue;
    if (n.every((u, f) => {
      const l = "inputs" in o && o.inputs[f];
      return l ? fa(u, l) : !1;
    })) {
      if (i && "inputs" in i && i.inputs) {
        const u = si(o.inputs, i.inputs, n);
        if (u)
          throw new qc({
            abiItem: o,
            type: u[0]
          }, {
            abiItem: i,
            type: u[1]
          });
      }
      i = o;
    }
  }
  return i || r[0];
}
function fa(e, t) {
  const n = typeof e, a = t.type;
  switch (a) {
    case "address":
      return St(e, { strict: !1 });
    case "bool":
      return n === "boolean";
    case "function":
      return n === "string";
    case "string":
      return n === "string";
    default:
      return a === "tuple" && "components" in t ? Object.values(t.components).every((s, r) => n === "object" && fa(Object.values(e)[r], s)) : /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(a) ? n === "number" || n === "bigint" : /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(a) ? n === "string" || e instanceof Uint8Array : /[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(a) ? Array.isArray(e) && e.every((s) => fa(s, {
        ...t,
        // Pop off `[]` or `[M]` from end of type
        type: a.replace(/(\[[0-9]{0,}\])$/, "")
      })) : !1;
  }
}
function si(e, t, n) {
  for (const a in e) {
    const s = e[a], r = t[a];
    if (s.type === "tuple" && r.type === "tuple" && "components" in s && "components" in r)
      return si(s.components, r.components, n[a]);
    const i = [s.type, r.type];
    if (i.includes("address") && i.includes("bytes20") ? !0 : i.includes("address") && i.includes("string") ? St(n[a], { strict: !1 }) : i.includes("address") && i.includes("bytes") ? St(n[a], { strict: !1 }) : !1)
      return i;
  }
}
const ps = "/docs/contract/encodeFunctionData";
function ed(e) {
  const { abi: t, args: n, functionName: a } = e;
  let s = t[0];
  if (a) {
    const r = K1({
      abi: t,
      args: n,
      name: a
    });
    if (!r)
      throw new is(a, { docsPath: ps });
    s = r;
  }
  if (s.type !== "function")
    throw new is(void 0, { docsPath: ps });
  return {
    abi: [s],
    functionName: ai(ca(s))
  };
}
function De(e) {
  const { args: t } = e, { abi: n, functionName: a } = e.abi.length === 1 && e.functionName?.startsWith("0x") ? e : ed(e), s = n[0], r = a, i = "inputs" in s && s.inputs ? st(s.inputs, t ?? []) : void 0;
  return D0([r, i ?? "0x"]);
}
const Fn = "/docs/contract/encodeDeployData";
function ri(e) {
  const { abi: t, args: n, bytecode: a } = e;
  if (!n || n.length === 0)
    return a;
  const s = t.find((i) => "type" in i && i.type === "constructor");
  if (!s)
    throw new Jc({ docsPath: Fn });
  if (!("inputs" in s))
    throw new rs({ docsPath: Fn });
  if (!s.inputs || s.inputs.length === 0)
    throw new rs({ docsPath: Fn });
  const r = st(s.inputs, n);
  return D0([a, r]);
}
function Rt(e, t) {
  if (e.length !== t.length)
    throw new Rr({
      expectedLength: e.length,
      givenLength: t.length
    });
  const n = [];
  for (let a = 0; a < e.length; a++) {
    const s = e[a], r = t[a];
    n.push(ii(s, r));
  }
  return D0(n);
}
function ii(e, t, n = !1) {
  if (e === "address") {
    const i = t;
    if (!St(i))
      throw new qr({ address: i });
    return he(i.toLowerCase(), {
      size: n ? 32 : null
    });
  }
  if (e === "string")
    return xa(t);
  if (e === "bytes")
    return t;
  if (e === "bool")
    return he(Ca(t), { size: n ? 32 : 1 });
  const a = e.match(ti);
  if (a) {
    const [i, o, c = "256"] = a, u = Number.parseInt(c, 10) / 8;
    return Re(t, {
      size: n ? 32 : u,
      signed: o === "int"
    });
  }
  const s = e.match(G1);
  if (s) {
    const [i, o] = s;
    if (Number.parseInt(o, 10) !== (t.length - 2) / 2)
      throw new Hc({
        expectedSize: Number.parseInt(o, 10),
        givenSize: (t.length - 2) / 2
      });
    return he(t, { dir: "right", size: n ? 32 : null });
  }
  const r = e.match(z1);
  if (r && Array.isArray(t)) {
    const [i, o] = r, c = [];
    for (let u = 0; u < t.length; u++)
      c.push(ii(o, t[u], !0));
    return c.length === 0 ? "0x" : D0(c);
  }
  throw new t1(e);
}
const td = "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE", nd = [
  {
    label: "Delegate",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0x587cde1e00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab",
    before: "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
    after: "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
    changesAt: 0
  },
  {
    label: "Adapter pass",
    to: "0x90b5292a5074cfdd665c726b433cc0a97e0da6ab",
    data: "0xa7a1ed72",
    before: "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13",
    after: "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13",
    changesAt: 0
  },
  {
    label: "Pass adapter",
    to: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
    data: "0x03eadcfc",
    before: "0x00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab",
    after: "0x00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab",
    changesAt: 0
  },
  {
    label: "Pass state",
    to: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
    data: "0xc19d93fb",
    before: "0x0000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Send library",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0xb96a277f00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000009f8c645f2d0b2159767bd6e0839de4be49e823de",
    after: "0x0000000000000000000000009f8c645f2d0b2159767bd6e0839de4be49e823de",
    changesAt: 0
  },
  {
    label: "Default send library flag",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0xdc93c8a200000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000001",
    after: "0x0000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 1
  },
  {
    label: "Receive library",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0x402f846800000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x000000000000000000000000b217266c3a98c8b2709ee26836c98cf12f6ccec10000000000000000000000000000000000000000000000000000000000000001",
    after: "0x000000000000000000000000b217266c3a98c8b2709ee26836c98cf12f6ccec10000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 2
  },
  {
    label: "Receive timeout",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0xef667aa100000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Explicit send security",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x39e3f93800000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000ff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 3
  },
  {
    label: "Explicit receive security",
    to: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
    data: "0x39e3f93800000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000ff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 4
  },
  {
    label: "Explicit executor",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x4d96320000000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    changesAt: 3
  },
  {
    label: "Effective send security",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x43ea4fa900000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 3
  },
  {
    label: "Effective receive security",
    to: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
    data: "0x43ea4fa900000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 4
  },
  {
    label: "Effective executor",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x188183f400000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    after: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    changesAt: 0
  },
  {
    label: "Protocol default Effective send security",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x43ea4fa9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Protocol default Effective receive security",
    to: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
    data: "0x43ea4fa9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Protocol default Effective executor",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x188183f4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    after: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    changesAt: 0
  }
], ad = {
  "0x1a44076050125825900e736c501f859c50fe728c": "c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039",
  "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE": "281e2b773062ba45ff33aab2a78d221667bafd036529d7cf651794404d7f93e2",
  "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1": "eec1e49d8439c2863f169cfc6455fd8fdb30d916ec52387a9eb149dbc83cfd2c"
}, kt = {
  sendLibrary: td,
  reads: nd,
  code: ad
}, sd = {
  TreeSuitePass: {
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "verifier",
            type: "address"
          }
        ],
        stateMutability: "nonpayable",
        type: "constructor"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "sender",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          },
          {
            internalType: "address",
            name: "owner",
            type: "address"
          }
        ],
        name: "ERC721IncorrectOwner",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "operator",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "ERC721InsufficientApproval",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "approver",
            type: "address"
          }
        ],
        name: "ERC721InvalidApprover",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "operator",
            type: "address"
          }
        ],
        name: "ERC721InvalidOperator",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          }
        ],
        name: "ERC721InvalidOwner",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "receiver",
            type: "address"
          }
        ],
        name: "ERC721InvalidReceiver",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "sender",
            type: "address"
          }
        ],
        name: "ERC721InvalidSender",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "ERC721NonexistentToken",
        type: "error"
      },
      {
        inputs: [],
        name: "Invalid",
        type: "error"
      },
      {
        inputs: [],
        name: "ReentrancyGuardReentrantCall",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "token",
            type: "address"
          }
        ],
        name: "SafeERC20FailedOperation",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "length",
            type: "uint256"
          }
        ],
        name: "StringsInsufficientHexLength",
        type: "error"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "address",
            name: "approved",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "Approval",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "address",
            name: "operator",
            type: "address"
          },
          {
            indexed: !1,
            internalType: "bool",
            name: "approved",
            type: "bool"
          }
        ],
        name: "ApprovalForAll",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "buyer",
            type: "address"
          },
          {
            indexed: !1,
            internalType: "uint256",
            name: "amount",
            type: "uint256"
          }
        ],
        name: "PassPurchased",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !1,
            internalType: "bool",
            name: "paused",
            type: "bool"
          }
        ],
        name: "PurchasePauseChanged",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          }
        ],
        name: "RedemptionFinalized",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          },
          {
            indexed: !0,
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          },
          {
            indexed: !1,
            internalType: "bytes32",
            name: "recipient",
            type: "bytes32"
          }
        ],
        name: "RedemptionRequested",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "route",
            type: "bytes32"
          },
          {
            indexed: !0,
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          }
        ],
        name: "ReserveConfirmed",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "Transfer",
        type: "event"
      },
      {
        inputs: [],
        name: "PRICE",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "TOKEN_ID",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "sourceRoute",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "suiRecipient",
            type: "bytes32"
          }
        ],
        name: "acknowledge",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "adapter",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "approve",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "backingNFT",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          }
        ],
        name: "balanceOf",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "buy",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "wallet",
            type: "address"
          }
        ],
        name: "canPlay",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "sourceRoute",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          }
        ],
        name: "confirmReserve",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "controller",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "currency",
        outputs: [
          {
            internalType: "contract IERC20",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "getApproved",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "initialBuyer",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            internalType: "address",
            name: "operator",
            type: "address"
          }
        ],
        name: "isApprovedForAll",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "name",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "ownerOf",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "purchasesPaused",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "recipient",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemption",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "suiRecipient",
            type: "bytes32"
          }
        ],
        name: "requestRedemption",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "route",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "operator",
            type: "address"
          },
          {
            internalType: "bool",
            name: "approved",
            type: "bool"
          }
        ],
        name: "setApprovalForAll",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bool",
            name: "paused",
            type: "bool"
          }
        ],
        name: "setPurchasesPaused",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "state",
        outputs: [
          {
            internalType: "enum TreeSuitePass.State",
            name: "",
            type: "uint8"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes4",
            name: "interfaceId",
            type: "bytes4"
          }
        ],
        name: "supportsInterface",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "symbol",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "tokenURI",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "transferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "treasury",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    creationBytecode: "0x610100604052600a805460ff1916600117905534801561001d575f5ffd5b5060405161277338038061277383398101604081905261003c91610471565b6040518060600160405280602181526020016127526021913960408051808201909152600981526854524545504153533160b81b60208201525f6100808382610536565b50600161008d8282610536565b50506001600655504660381415806100b857507355d398326f99059ff775485246999027b31979553b155b806100cb57506001600160a01b0381163b155b8061014d57507355d398326f99059ff775485246999027b31979556001600160a01b031663313ce5676040518163ffffffff1660e01b8152600401602060405180830381865afa158015610121573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061014591906105f0565b60ff16601214155b1561016b57604051636dac6a0960e01b815260040160405180910390fd5b5f819050336001600160a01b0316816001600160a01b031663acba7b426040518163ffffffff1660e01b8152600401602060405180830381865afa1580156101b5573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101d99190610471565b6001600160a01b03161415806102745750731a44076050125825900e736c501f859c50fe728c6001600160a01b0316816001600160a01b0316635e280f116040518163ffffffff1660e01b8152600401602060405180830381865afa158015610244573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102689190610471565b6001600160a01b031614155b806102dc5750806001600160a01b03166315aff54e6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156102b6573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102da9190610610565b155b806103445750806001600160a01b031663d96661ef6040518163ffffffff1660e01b8152600401602060405180830381865afa15801561031e573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103429190610610565b155b806103d057507f046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba5f1b816001600160a01b03166378360c886040518163ffffffff1660e01b8152600401602060405180830381865afa1580156103a9573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103cd9190610610565b14155b156103ee57604051636dac6a0960e01b815260040160405180910390fd5b6001600160a01b038083166080523360a081905260c0526040805163d96661ef60e01b815290519183169163d96661ef916004808201926020929091908290030181865afa158015610442573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104669190610610565b60e052506106279050565b5f60208284031215610481575f5ffd5b81516001600160a01b0381168114610497575f5ffd5b9392505050565b634e487b7160e01b5f52604160045260245ffd5b600181811c908216806104c657607f821691505b6020821081036104e457634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561053157805f5260205f20601f840160051c8101602085101561050f5750805b601f840160051c820191505b8181101561052e575f815560010161051b565b50505b505050565b81516001600160401b0381111561054f5761054f61049e565b6105638161055d84546104b2565b846104ea565b6020601f821160018114610595575f831561057e5750848201515b5f19600385901b1c1916600184901b17845561052e565b5f84815260208120601f198516915b828110156105c457878501518255602094850194600190920191016105a4565b50848210156105e157868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b5f60208284031215610600575f5ffd5b815160ff81168114610497575f5ffd5b5f60208284031215610620575f5ffd5b5051919050565b60805160a05160c05160e0516120b96106995f395f818161043d0152818161067c0152818161096f015281816109f801528181610ae50152610e5501525f8181610492015261083101525f81816103410152610bf101525f818161021801528181610634015261092f01526120b95ff3fe608060405234801561000f575f5ffd5b50600436106101e7575f3560e01c806378360c8811610109578063b88d4fde1161009e578063d96661ef1161006e578063d96661ef14610438578063e5a6b10f1461045f578063e985e9c51461047a578063f77c47911461048d575f5ffd5b8063b88d4fde146103eb578063c19d93fb146103fe578063c87b56dd14610418578063c9f207151461042b575f5ffd5b806395d89b41116100d957806395d89b41146103b557806397579dd3146103bd578063a22cb465146103d0578063a6f2ae3a146103e3575f5ffd5b806378360c8814610376578063838c037d1461038a57806389a890021461039d5780638d859f3e146103a5575f5ffd5b8063325832ac1161017f5780636352211e1161014f5780636352211e1461032057806366d003ac146103335780636af7f9f51461033c57806370a0823114610363575f5ffd5b8063325832ac146102c857806342842e0e146102db5780635467e0a7146102ee57806361d027b314610305575f5ffd5b80630823d5f3116101ba5780630823d5f31461027a578063095ea7b31461028d57806314023905146102a257806323b872dd146102b5575f5ffd5b806301ffc9a7146101eb57806303eadcfc1461021357806306fdde0314610252578063081812fc14610267575b5f5ffd5b6101fe6101f936600461192a565b6104b4565b60405190151581526020015b60405180910390f35b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200161020a565b61025a610505565b60405161020a9190611992565b61023a6102753660046119a4565b610594565b6101fe6102883660046119d1565b6105bb565b6102a061029b3660046119ea565b61061a565b005b6102a06102b0366004611a12565b610629565b6102a06102c3366004611a41565b61079e565b6102a06102d6366004611a8a565b610826565b6102a06102e9366004611a41565b6108b6565b6102f760085481565b60405190815260200161020a565b61023a73c440f06bbc7e58b0d055815f915447e4ae0e372081565b61023a61032e3660046119a4565b6108d5565b6102f760095481565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6102f76103713660046119d1565b6108df565b6102f75f5160206120645f395f51905f5281565b6102a0610398366004611aa3565b610924565b6102f7600181565b6102f768015af1d78b58c4000081565b61025a610a41565b6102f76103cb3660046119a4565b610a50565b6102a06103de366004611ac3565b610ba5565b6102a0610bb0565b6102a06103f9366004611b08565b610e11565b60075461040b9060ff1681565b60405161020a9190611bf9565b61025a6104263660046119a4565b610e29565b600a546101fe9060ff1681565b6102f77f000000000000000000000000000000000000000000000000000000000000000081565b61023a7355d398326f99059ff775485246999027b319795581565b6101fe610488366004611c1f565b610ec6565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b5f6001600160e01b031982166380ac58cd60e01b14806104e457506001600160e01b03198216635b5e139f60e01b145b806104ff57506301ffc9a760e01b6001600160e01b03198316145b92915050565b60605f805461051390611c47565b80601f016020809104026020016040519081016040528092919081815260200182805461053f90611c47565b801561058a5780601f106105615761010080835404028352916020019161058a565b820191905f5260205f20905b81548152906001019060200180831161056d57829003601f168201915b5050505050905090565b5f61059e82610ef3565b505f828152600460205260409020546001600160a01b03166104ff565b5f600260075460ff1660048111156105d5576105d5611be5565b1480156104ff57505060015f5260026020527fe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0546001600160a01b0390811691161490565b610625828233610f2b565b5050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461067257604051636dac6a0960e01b815260040160405180910390fd5b61067a610f38565b7f0000000000000000000000000000000000000000000000000000000000000000841415806106b657505f5160206120645f395f51905f528314155b806106bf575081155b806106cc57506008548214155b806106d957506009548114155b156106f757604051636dac6a0960e01b815260040160405180910390fd5b600460075460ff16600481111561071057610710611be5565b1461078e57600360075460ff16600481111561072e5761072e611be5565b1461074c57604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660041790556107636001610f62565b60405182907f33bf3780ab321f3c6eb7eba598dcd21e3989005d9e37e811e7182984e5a86865905f90a25b6107986001600655565b50505050565b6001600160a01b0382166107cc57604051633250574960e11b81525f60048201526024015b60405180910390fd5b5f6107d8838333610f9a565b9050836001600160a01b0316816001600160a01b031614610798576040516364283d7b60e01b81526001600160a01b03808616600483015260248201849052821660448201526064016107c3565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461086f57604051636dac6a0960e01b815260040160405180910390fd5b600a805460ff19168215159081179091556040519081527fd6d0fdd597c17a0211f0324826035a55dec84b1e6196f3585be220b46767fbb99060200160405180910390a150565b6108d083838360405180602001604052805f815250610e11565b505050565b5f6104ff82610ef3565b5f6001600160a01b038216610909576040516322718ad960e21b81525f60048201526024016107c3565b506001600160a01b03165f9081526003602052604090205490565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461096d57604051636dac6a0960e01b815260040160405180910390fd5b7f0000000000000000000000000000000000000000000000000000000000000000821415806109a957505f5160206120645f395f51905f528114155b156109c757604051636dac6a0960e01b815260040160405180910390fd5b5f60075460ff1660048111156109df576109df611be5565b03610625576007805460ff1916600117905560405181907f0000000000000000000000000000000000000000000000000000000000000000907fecf6c6e4df87a879d81225cf14697cca67eb2841ecbc03b2e97d9f71ea2008d4905f90a35050565b60606001805461051390611c47565b5f610a59610f38565b600260075460ff166004811115610a7257610a72611be5565b141580610a91575033610a8560016108d5565b6001600160a01b031614155b80610a9a575081155b15610ab857604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660031790556009829055604080516002602082015246918101919091523060608201527f000000000000000000000000000000000000000000000000000000000000000060808201525f5160206120645f395f51905f5260a0820152600160c08201523360e082015261010081018390526101200160408051808303601f1901815290829052805160209182012060088190558483525f5160206120645f395f51905f529290917fa71f7451e8d1e77318e5ba0935a7036781ceb676e25e961a567ec08b2b6b8bff910160405180910390a350600854610ba06001600655565b919050565b61062533838361101f565b610bb8610f38565b600160075460ff166004811115610bd157610bd1611be5565b141580610be05750600a5460ff165b80610c145750336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614155b15610c3257604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660021790556040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201525f907355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610ca2573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610cc69190611c7f565b9050610d057355d398326f99059ff775485246999027b31979553373c440f06bbc7e58b0d055815f915447e4ae0e372068015af1d78b58c400006110bd565b610d1868015af1d78b58c4000082611caa565b6040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201527355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610d79573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d9d9190611c7f565b14610dbb57604051636dac6a0960e01b815260040160405180910390fd5b610dc6336001611117565b60405168015af1d78b58c40000815233907f4d81376e817f538bfc3647b67ca726bb2e4bd2cd7a79a7b5da522df6a15e25859060200160405180910390a250610e0f6001600655565b565b610e1c84848461079e565b6107983385858585611130565b6060610e3482610ef3565b50610ea0610e505f5160206120645f395f51905f526020611258565b610e7b7f00000000000000000000000000000000000000000000000000000000000000006020611258565b604051602001610e8c929190611cd8565b6040516020818303038152906040526113d2565b604051602001610eb09190611f29565b6040516020818303038152906040529050919050565b6001600160a01b039182165f90815260056020908152604080832093909416825291909152205460ff1690565b5f818152600260205260408120546001600160a01b0316806104ff57604051637e27328960e01b8152600481018490526024016107c3565b6108d083838360016113f8565b600260065403610f5b57604051633ee5aeb560e01b815260040160405180910390fd5b6002600655565b5f610f6e5f835f610f9a565b90506001600160a01b03811661062557604051637e27328960e01b8152600481018390526024016107c3565b5f600260075460ff166004811115610fb457610fb4611be5565b14158015610fec5750600460075460ff166004811115610fd657610fd6611be5565b148015610fea57506001600160a01b038416155b155b1561100a57604051636dac6a0960e01b815260040160405180910390fd5b6110158484846114fc565b90505b9392505050565b6001600160a01b03821661105157604051630b61174360e31b81526001600160a01b03831660048201526024016107c3565b6001600160a01b038381165f81815260056020908152604080832094871680845294825291829020805460ff191686151590811790915591519182527f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a3505050565b604080516001600160a01b0385811660248301528416604482015260648082018490528251808303909101815260849091019091526020810180516001600160e01b03166323b872dd60e01b1790526107989085906115ee565b610625828260405180602001604052805f81525061165a565b6001600160a01b0383163b1561125157604051630a85bd0160e11b81526001600160a01b0384169063150b7a0290611172908890889087908790600401611f6d565b6020604051808303815f875af19250505080156111ac575060408051601f3d908101601f191682019092526111a991810190611fa9565b60015b611213573d8080156111d9576040519150601f19603f3d011682016040523d82523d5f602084013e6111de565b606091505b5080515f0361120b57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b805160208201fd5b6001600160e01b03198116630a85bd0160e11b1461124f57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b505b5050505050565b6060825f611267846002611fc4565b611272906002611caa565b67ffffffffffffffff81111561128a5761128a611af4565b6040519080825280601f01601f1916602001820160405280156112b4576020820181803683370190505b509050600360fc1b815f815181106112ce576112ce611fdb565b60200101906001600160f81b03191690815f1a905350600f60fb1b816001815181106112fc576112fc611fdb565b60200101906001600160f81b03191690815f1a9053505f61131e856002611fc4565b611329906001611caa565b90505b60018111156113a0576f181899199a1a9b1b9c1cb0b131b232b360811b83600f166010811061135d5761135d611fdb565b1a60f81b82828151811061137357611373611fdb565b60200101906001600160f81b03191690815f1a90535060049290921c9161139981611fef565b905061132c565b5081156113ca5760405163e22e27eb60e01b815260048101869052602481018590526044016107c3565b949350505050565b60606104ff82604051806060016040528060408152602001612024604091396001611671565b808061140c57506001600160a01b03821615155b156114cd575f61141b84610ef3565b90506001600160a01b038316158015906114475750826001600160a01b0316816001600160a01b031614155b801561145a57506114588184610ec6565b155b156114835760405163a9fbf51f60e01b81526001600160a01b03841660048201526024016107c3565b81156114cb5783856001600160a01b0316826001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b50505f90815260046020526040902080546001600160a01b0319166001600160a01b0392909216919091179055565b5f828152600260205260408120546001600160a01b0390811690831615611528576115288184866117ec565b6001600160a01b03811615611562576115435f855f5f6113f8565b6001600160a01b0381165f90815260036020526040902080545f190190555b6001600160a01b03851615611590576001600160a01b0385165f908152600360205260409020805460010190555b5f8481526002602052604080822080546001600160a01b0319166001600160a01b0389811691821790925591518793918516917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4949350505050565b5f5f60205f8451602086015f885af18061160d576040513d5f823e3d81fd5b50505f513d91508115611624578060011415611631565b6001600160a01b0384163b155b1561079857604051635274afe760e01b81526001600160a01b03851660048201526024016107c3565b6116648383611850565b6108d0335f858585611130565b606083515f0361168f575060408051602081019091525f8152611018565b5f826116bf576003855160046116a59190611fc4565b6116b0906002611caa565b6116ba9190612004565b6116e4565b6003855160026116cf9190611caa565b6116d99190612004565b6116e4906004611fc4565b90505f8167ffffffffffffffff81111561170057611700611af4565b6040519080825280601f01601f19166020018201604052801561172a576020820181803683370190505b509050600185016020820187885189016020810180515f82525b8284101561179f576003840193508351603f8160121c168701518653600186019550603f81600c1c168701518653600186019550603f8160061c168701518653600186019550603f8116870151865350600185019450611744565b9052505085156117e0576003885106600181146117c357600281146117d6576117de565b603d6001830353603d60028303536117de565b603d60018303535b505b50909695505050505050565b6117f78383836118b1565b6108d0576001600160a01b03831661182557604051637e27328960e01b8152600481018290526024016107c3565b60405163177e802f60e01b81526001600160a01b0383166004820152602481018290526044016107c3565b6001600160a01b03821661187957604051633250574960e11b81525f60048201526024016107c3565b5f61188583835f610f9a565b90506001600160a01b038116156108d0576040516339e3563760e11b81525f60048201526024016107c3565b5f6001600160a01b038316158015906110155750826001600160a01b0316846001600160a01b031614806118ea57506118ea8484610ec6565b806110155750505f908152600460205260409020546001600160a01b03908116911614919050565b6001600160e01b031981168114611927575f5ffd5b50565b5f6020828403121561193a575f5ffd5b813561101881611912565b5f5b8381101561195f578181015183820152602001611947565b50505f910152565b5f815180845261197e816020860160208601611945565b601f01601f19169290920160200192915050565b602081525f6110186020830184611967565b5f602082840312156119b4575f5ffd5b5035919050565b80356001600160a01b0381168114610ba0575f5ffd5b5f602082840312156119e1575f5ffd5b611018826119bb565b5f5f604083850312156119fb575f5ffd5b611a04836119bb565b946020939093013593505050565b5f5f5f5f60808587031215611a25575f5ffd5b5050823594602084013594506040840135936060013592509050565b5f5f5f60608486031215611a53575f5ffd5b611a5c846119bb565b9250611a6a602085016119bb565b929592945050506040919091013590565b80358015158114610ba0575f5ffd5b5f60208284031215611a9a575f5ffd5b61101882611a7b565b5f5f60408385031215611ab4575f5ffd5b50508035926020909101359150565b5f5f60408385031215611ad4575f5ffd5b611add836119bb565b9150611aeb60208401611a7b565b90509250929050565b634e487b7160e01b5f52604160045260245ffd5b5f5f5f5f60808587031215611b1b575f5ffd5b611b24856119bb565b9350611b32602086016119bb565b925060408501359150606085013567ffffffffffffffff811115611b54575f5ffd5b8501601f81018713611b64575f5ffd5b803567ffffffffffffffff811115611b7e57611b7e611af4565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715611bad57611bad611af4565b604052818152828201602001891015611bc4575f5ffd5b816020840160208301375f6020838301015280935050505092959194509250565b634e487b7160e01b5f52602160045260245ffd5b6020810160058310611c1957634e487b7160e01b5f52602160045260245ffd5b91905290565b5f5f60408385031215611c30575f5ffd5b611c39836119bb565b9150611aeb602084016119bb565b600181811c90821680611c5b57607f821691505b602082108103611c7957634e487b7160e01b5f52602260045260245ffd5b50919050565b5f60208284031215611c8f575f5ffd5b5051919050565b634e487b7160e01b5f52601160045260245ffd5b808201808211156104ff576104ff611c96565b5f8151611cce818560208601611945565b9290920192915050565b7f7b226e616d65223a22547265652041726361646520537569746520506173732081527f2d204e46547265652032373230222c226465736372697074696f6e223a22547260208201527f616e7366657261626c6520737569746520616363657373206261636b6564206260408201527f79206f726967696e616c20537569204e465472656520323732302e205265646560608201527f6d7074696f6e206c6f636b732074686973207061737320756e74696c2061757460808201527f68656e746963617465642072656c6561736520616e64207265746972656d656e60a0820152631d0b888b60e21b60c08201527f22696d616765223a2268747470733a2f2f626c61636b2d70657273697374656e60c48201527f742d63617079626172612d3237392e6d7970696e6174612e636c6f75642f697060e48201527f66732f62616679626569656f7a67766e72377163346768737133367a777373756101048201527f686a37786168757a6e6a6c6d7536673633636c6e79743337686a7369346d2f32610124820152680dcc8c0b9a9c19c88b60ba1b6101448201527f2265787465726e616c5f75726c223a2268747470733a2f2f747265652d746f6b61014d8201527f656e2e78797a2f706c61792f222c226261636b696e675f636861696e223a227361016d8201527f75693a6d61696e6e6574222c226261636b696e675f6e6674223a22000000000061018d8201525f611ef76101a8830185611cbd565b6a1116113937baba32911d1160a91b8152611f15600b820185611cbd565b61227d60f01b815260020195945050505050565b7f646174613a6170706c69636174696f6e2f6a736f6e3b6261736536342c00000081525f8251611f6081601d850160208701611945565b91909101601d0192915050565b6001600160a01b03858116825284166020820152604081018390526080606082018190525f90611f9f90830184611967565b9695505050505050565b5f60208284031215611fb9575f5ffd5b815161101881611912565b80820281158282048414176104ff576104ff611c96565b634e487b7160e01b5f52603260045260245ffd5b5f81611ffd57611ffd611c96565b505f190190565b5f8261201e57634e487b7160e01b5f52601260045260245ffd5b50049056fe4142434445464748494a4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435363738392b2f046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa26469706673582212203ac6d98b05809f5934e421555a2e4d8d47c5624f10d057a7da03323ceab66a5f64736f6c634300081e00334e46547265652053756974652050617373202d204f6e65204e465420547269616c",
    runtimeTemplate: "0x608060405234801561000f575f5ffd5b50600436106101e7575f3560e01c806378360c8811610109578063b88d4fde1161009e578063d96661ef1161006e578063d96661ef14610438578063e5a6b10f1461045f578063e985e9c51461047a578063f77c47911461048d575f5ffd5b8063b88d4fde146103eb578063c19d93fb146103fe578063c87b56dd14610418578063c9f207151461042b575f5ffd5b806395d89b41116100d957806395d89b41146103b557806397579dd3146103bd578063a22cb465146103d0578063a6f2ae3a146103e3575f5ffd5b806378360c8814610376578063838c037d1461038a57806389a890021461039d5780638d859f3e146103a5575f5ffd5b8063325832ac1161017f5780636352211e1161014f5780636352211e1461032057806366d003ac146103335780636af7f9f51461033c57806370a0823114610363575f5ffd5b8063325832ac146102c857806342842e0e146102db5780635467e0a7146102ee57806361d027b314610305575f5ffd5b80630823d5f3116101ba5780630823d5f31461027a578063095ea7b31461028d57806314023905146102a257806323b872dd146102b5575f5ffd5b806301ffc9a7146101eb57806303eadcfc1461021357806306fdde0314610252578063081812fc14610267575b5f5ffd5b6101fe6101f936600461192a565b6104b4565b60405190151581526020015b60405180910390f35b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200161020a565b61025a610505565b60405161020a9190611992565b61023a6102753660046119a4565b610594565b6101fe6102883660046119d1565b6105bb565b6102a061029b3660046119ea565b61061a565b005b6102a06102b0366004611a12565b610629565b6102a06102c3366004611a41565b61079e565b6102a06102d6366004611a8a565b610826565b6102a06102e9366004611a41565b6108b6565b6102f760085481565b60405190815260200161020a565b61023a73c440f06bbc7e58b0d055815f915447e4ae0e372081565b61023a61032e3660046119a4565b6108d5565b6102f760095481565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6102f76103713660046119d1565b6108df565b6102f75f5160206120645f395f51905f5281565b6102a0610398366004611aa3565b610924565b6102f7600181565b6102f768015af1d78b58c4000081565b61025a610a41565b6102f76103cb3660046119a4565b610a50565b6102a06103de366004611ac3565b610ba5565b6102a0610bb0565b6102a06103f9366004611b08565b610e11565b60075461040b9060ff1681565b60405161020a9190611bf9565b61025a6104263660046119a4565b610e29565b600a546101fe9060ff1681565b6102f77f000000000000000000000000000000000000000000000000000000000000000081565b61023a7355d398326f99059ff775485246999027b319795581565b6101fe610488366004611c1f565b610ec6565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b5f6001600160e01b031982166380ac58cd60e01b14806104e457506001600160e01b03198216635b5e139f60e01b145b806104ff57506301ffc9a760e01b6001600160e01b03198316145b92915050565b60605f805461051390611c47565b80601f016020809104026020016040519081016040528092919081815260200182805461053f90611c47565b801561058a5780601f106105615761010080835404028352916020019161058a565b820191905f5260205f20905b81548152906001019060200180831161056d57829003601f168201915b5050505050905090565b5f61059e82610ef3565b505f828152600460205260409020546001600160a01b03166104ff565b5f600260075460ff1660048111156105d5576105d5611be5565b1480156104ff57505060015f5260026020527fe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0546001600160a01b0390811691161490565b610625828233610f2b565b5050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461067257604051636dac6a0960e01b815260040160405180910390fd5b61067a610f38565b7f0000000000000000000000000000000000000000000000000000000000000000841415806106b657505f5160206120645f395f51905f528314155b806106bf575081155b806106cc57506008548214155b806106d957506009548114155b156106f757604051636dac6a0960e01b815260040160405180910390fd5b600460075460ff16600481111561071057610710611be5565b1461078e57600360075460ff16600481111561072e5761072e611be5565b1461074c57604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660041790556107636001610f62565b60405182907f33bf3780ab321f3c6eb7eba598dcd21e3989005d9e37e811e7182984e5a86865905f90a25b6107986001600655565b50505050565b6001600160a01b0382166107cc57604051633250574960e11b81525f60048201526024015b60405180910390fd5b5f6107d8838333610f9a565b9050836001600160a01b0316816001600160a01b031614610798576040516364283d7b60e01b81526001600160a01b03808616600483015260248201849052821660448201526064016107c3565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461086f57604051636dac6a0960e01b815260040160405180910390fd5b600a805460ff19168215159081179091556040519081527fd6d0fdd597c17a0211f0324826035a55dec84b1e6196f3585be220b46767fbb99060200160405180910390a150565b6108d083838360405180602001604052805f815250610e11565b505050565b5f6104ff82610ef3565b5f6001600160a01b038216610909576040516322718ad960e21b81525f60048201526024016107c3565b506001600160a01b03165f9081526003602052604090205490565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461096d57604051636dac6a0960e01b815260040160405180910390fd5b7f0000000000000000000000000000000000000000000000000000000000000000821415806109a957505f5160206120645f395f51905f528114155b156109c757604051636dac6a0960e01b815260040160405180910390fd5b5f60075460ff1660048111156109df576109df611be5565b03610625576007805460ff1916600117905560405181907f0000000000000000000000000000000000000000000000000000000000000000907fecf6c6e4df87a879d81225cf14697cca67eb2841ecbc03b2e97d9f71ea2008d4905f90a35050565b60606001805461051390611c47565b5f610a59610f38565b600260075460ff166004811115610a7257610a72611be5565b141580610a91575033610a8560016108d5565b6001600160a01b031614155b80610a9a575081155b15610ab857604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660031790556009829055604080516002602082015246918101919091523060608201527f000000000000000000000000000000000000000000000000000000000000000060808201525f5160206120645f395f51905f5260a0820152600160c08201523360e082015261010081018390526101200160408051808303601f1901815290829052805160209182012060088190558483525f5160206120645f395f51905f529290917fa71f7451e8d1e77318e5ba0935a7036781ceb676e25e961a567ec08b2b6b8bff910160405180910390a350600854610ba06001600655565b919050565b61062533838361101f565b610bb8610f38565b600160075460ff166004811115610bd157610bd1611be5565b141580610be05750600a5460ff165b80610c145750336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614155b15610c3257604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660021790556040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201525f907355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610ca2573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610cc69190611c7f565b9050610d057355d398326f99059ff775485246999027b31979553373c440f06bbc7e58b0d055815f915447e4ae0e372068015af1d78b58c400006110bd565b610d1868015af1d78b58c4000082611caa565b6040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201527355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610d79573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d9d9190611c7f565b14610dbb57604051636dac6a0960e01b815260040160405180910390fd5b610dc6336001611117565b60405168015af1d78b58c40000815233907f4d81376e817f538bfc3647b67ca726bb2e4bd2cd7a79a7b5da522df6a15e25859060200160405180910390a250610e0f6001600655565b565b610e1c84848461079e565b6107983385858585611130565b6060610e3482610ef3565b50610ea0610e505f5160206120645f395f51905f526020611258565b610e7b7f00000000000000000000000000000000000000000000000000000000000000006020611258565b604051602001610e8c929190611cd8565b6040516020818303038152906040526113d2565b604051602001610eb09190611f29565b6040516020818303038152906040529050919050565b6001600160a01b039182165f90815260056020908152604080832093909416825291909152205460ff1690565b5f818152600260205260408120546001600160a01b0316806104ff57604051637e27328960e01b8152600481018490526024016107c3565b6108d083838360016113f8565b600260065403610f5b57604051633ee5aeb560e01b815260040160405180910390fd5b6002600655565b5f610f6e5f835f610f9a565b90506001600160a01b03811661062557604051637e27328960e01b8152600481018390526024016107c3565b5f600260075460ff166004811115610fb457610fb4611be5565b14158015610fec5750600460075460ff166004811115610fd657610fd6611be5565b148015610fea57506001600160a01b038416155b155b1561100a57604051636dac6a0960e01b815260040160405180910390fd5b6110158484846114fc565b90505b9392505050565b6001600160a01b03821661105157604051630b61174360e31b81526001600160a01b03831660048201526024016107c3565b6001600160a01b038381165f81815260056020908152604080832094871680845294825291829020805460ff191686151590811790915591519182527f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a3505050565b604080516001600160a01b0385811660248301528416604482015260648082018490528251808303909101815260849091019091526020810180516001600160e01b03166323b872dd60e01b1790526107989085906115ee565b610625828260405180602001604052805f81525061165a565b6001600160a01b0383163b1561125157604051630a85bd0160e11b81526001600160a01b0384169063150b7a0290611172908890889087908790600401611f6d565b6020604051808303815f875af19250505080156111ac575060408051601f3d908101601f191682019092526111a991810190611fa9565b60015b611213573d8080156111d9576040519150601f19603f3d011682016040523d82523d5f602084013e6111de565b606091505b5080515f0361120b57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b805160208201fd5b6001600160e01b03198116630a85bd0160e11b1461124f57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b505b5050505050565b6060825f611267846002611fc4565b611272906002611caa565b67ffffffffffffffff81111561128a5761128a611af4565b6040519080825280601f01601f1916602001820160405280156112b4576020820181803683370190505b509050600360fc1b815f815181106112ce576112ce611fdb565b60200101906001600160f81b03191690815f1a905350600f60fb1b816001815181106112fc576112fc611fdb565b60200101906001600160f81b03191690815f1a9053505f61131e856002611fc4565b611329906001611caa565b90505b60018111156113a0576f181899199a1a9b1b9c1cb0b131b232b360811b83600f166010811061135d5761135d611fdb565b1a60f81b82828151811061137357611373611fdb565b60200101906001600160f81b03191690815f1a90535060049290921c9161139981611fef565b905061132c565b5081156113ca5760405163e22e27eb60e01b815260048101869052602481018590526044016107c3565b949350505050565b60606104ff82604051806060016040528060408152602001612024604091396001611671565b808061140c57506001600160a01b03821615155b156114cd575f61141b84610ef3565b90506001600160a01b038316158015906114475750826001600160a01b0316816001600160a01b031614155b801561145a57506114588184610ec6565b155b156114835760405163a9fbf51f60e01b81526001600160a01b03841660048201526024016107c3565b81156114cb5783856001600160a01b0316826001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b50505f90815260046020526040902080546001600160a01b0319166001600160a01b0392909216919091179055565b5f828152600260205260408120546001600160a01b0390811690831615611528576115288184866117ec565b6001600160a01b03811615611562576115435f855f5f6113f8565b6001600160a01b0381165f90815260036020526040902080545f190190555b6001600160a01b03851615611590576001600160a01b0385165f908152600360205260409020805460010190555b5f8481526002602052604080822080546001600160a01b0319166001600160a01b0389811691821790925591518793918516917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4949350505050565b5f5f60205f8451602086015f885af18061160d576040513d5f823e3d81fd5b50505f513d91508115611624578060011415611631565b6001600160a01b0384163b155b1561079857604051635274afe760e01b81526001600160a01b03851660048201526024016107c3565b6116648383611850565b6108d0335f858585611130565b606083515f0361168f575060408051602081019091525f8152611018565b5f826116bf576003855160046116a59190611fc4565b6116b0906002611caa565b6116ba9190612004565b6116e4565b6003855160026116cf9190611caa565b6116d99190612004565b6116e4906004611fc4565b90505f8167ffffffffffffffff81111561170057611700611af4565b6040519080825280601f01601f19166020018201604052801561172a576020820181803683370190505b509050600185016020820187885189016020810180515f82525b8284101561179f576003840193508351603f8160121c168701518653600186019550603f81600c1c168701518653600186019550603f8160061c168701518653600186019550603f8116870151865350600185019450611744565b9052505085156117e0576003885106600181146117c357600281146117d6576117de565b603d6001830353603d60028303536117de565b603d60018303535b505b50909695505050505050565b6117f78383836118b1565b6108d0576001600160a01b03831661182557604051637e27328960e01b8152600481018290526024016107c3565b60405163177e802f60e01b81526001600160a01b0383166004820152602481018290526044016107c3565b6001600160a01b03821661187957604051633250574960e11b81525f60048201526024016107c3565b5f61188583835f610f9a565b90506001600160a01b038116156108d0576040516339e3563760e11b81525f60048201526024016107c3565b5f6001600160a01b038316158015906110155750826001600160a01b0316846001600160a01b031614806118ea57506118ea8484610ec6565b806110155750505f908152600460205260409020546001600160a01b03908116911614919050565b6001600160e01b031981168114611927575f5ffd5b50565b5f6020828403121561193a575f5ffd5b813561101881611912565b5f5b8381101561195f578181015183820152602001611947565b50505f910152565b5f815180845261197e816020860160208601611945565b601f01601f19169290920160200192915050565b602081525f6110186020830184611967565b5f602082840312156119b4575f5ffd5b5035919050565b80356001600160a01b0381168114610ba0575f5ffd5b5f602082840312156119e1575f5ffd5b611018826119bb565b5f5f604083850312156119fb575f5ffd5b611a04836119bb565b946020939093013593505050565b5f5f5f5f60808587031215611a25575f5ffd5b5050823594602084013594506040840135936060013592509050565b5f5f5f60608486031215611a53575f5ffd5b611a5c846119bb565b9250611a6a602085016119bb565b929592945050506040919091013590565b80358015158114610ba0575f5ffd5b5f60208284031215611a9a575f5ffd5b61101882611a7b565b5f5f60408385031215611ab4575f5ffd5b50508035926020909101359150565b5f5f60408385031215611ad4575f5ffd5b611add836119bb565b9150611aeb60208401611a7b565b90509250929050565b634e487b7160e01b5f52604160045260245ffd5b5f5f5f5f60808587031215611b1b575f5ffd5b611b24856119bb565b9350611b32602086016119bb565b925060408501359150606085013567ffffffffffffffff811115611b54575f5ffd5b8501601f81018713611b64575f5ffd5b803567ffffffffffffffff811115611b7e57611b7e611af4565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715611bad57611bad611af4565b604052818152828201602001891015611bc4575f5ffd5b816020840160208301375f6020838301015280935050505092959194509250565b634e487b7160e01b5f52602160045260245ffd5b6020810160058310611c1957634e487b7160e01b5f52602160045260245ffd5b91905290565b5f5f60408385031215611c30575f5ffd5b611c39836119bb565b9150611aeb602084016119bb565b600181811c90821680611c5b57607f821691505b602082108103611c7957634e487b7160e01b5f52602260045260245ffd5b50919050565b5f60208284031215611c8f575f5ffd5b5051919050565b634e487b7160e01b5f52601160045260245ffd5b808201808211156104ff576104ff611c96565b5f8151611cce818560208601611945565b9290920192915050565b7f7b226e616d65223a22547265652041726361646520537569746520506173732081527f2d204e46547265652032373230222c226465736372697074696f6e223a22547260208201527f616e7366657261626c6520737569746520616363657373206261636b6564206260408201527f79206f726967696e616c20537569204e465472656520323732302e205265646560608201527f6d7074696f6e206c6f636b732074686973207061737320756e74696c2061757460808201527f68656e746963617465642072656c6561736520616e64207265746972656d656e60a0820152631d0b888b60e21b60c08201527f22696d616765223a2268747470733a2f2f626c61636b2d70657273697374656e60c48201527f742d63617079626172612d3237392e6d7970696e6174612e636c6f75642f697060e48201527f66732f62616679626569656f7a67766e72377163346768737133367a777373756101048201527f686a37786168757a6e6a6c6d7536673633636c6e79743337686a7369346d2f32610124820152680dcc8c0b9a9c19c88b60ba1b6101448201527f2265787465726e616c5f75726c223a2268747470733a2f2f747265652d746f6b61014d8201527f656e2e78797a2f706c61792f222c226261636b696e675f636861696e223a227361016d8201527f75693a6d61696e6e6574222c226261636b696e675f6e6674223a22000000000061018d8201525f611ef76101a8830185611cbd565b6a1116113937baba32911d1160a91b8152611f15600b820185611cbd565b61227d60f01b815260020195945050505050565b7f646174613a6170706c69636174696f6e2f6a736f6e3b6261736536342c00000081525f8251611f6081601d850160208701611945565b91909101601d0192915050565b6001600160a01b03858116825284166020820152604081018390526080606082018190525f90611f9f90830184611967565b9695505050505050565b5f60208284031215611fb9575f5ffd5b815161101881611912565b80820281158282048414176104ff576104ff611c96565b634e487b7160e01b5f52603260045260245ffd5b5f81611ffd57611ffd611c96565b505f190190565b5f8261201e57634e487b7160e01b5f52601260045260245ffd5b50049056fe4142434445464748494a4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435363738392b2f046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa26469706673582212203ac6d98b05809f5934e421555a2e4d8d47c5624f10d057a7da03323ceab66a5f64736f6c634300081e0033",
    immutableReferences: {
      870: [
        {
          length: 32,
          start: 536
        },
        {
          length: 32,
          start: 1588
        },
        {
          length: 32,
          start: 2351
        }
      ],
      872: [
        {
          length: 32,
          start: 833
        },
        {
          length: 32,
          start: 3057
        }
      ],
      874: [
        {
          length: 32,
          start: 1170
        },
        {
          length: 32,
          start: 2097
        }
      ],
      876: [
        {
          length: 32,
          start: 1085
        },
        {
          length: 32,
          start: 1660
        },
        {
          length: 32,
          start: 2415
        },
        {
          length: 32,
          start: 2552
        },
        {
          length: 32,
          start: 2789
        },
        {
          length: 32,
          start: 3669
        }
      ]
    }
  },
  TreePassAdapter: {
    abi: [
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "peer",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "routeId",
            type: "bytes32"
          }
        ],
        stateMutability: "nonpayable",
        type: "constructor"
      },
      {
        inputs: [],
        name: "Invalid",
        type: "error"
      },
      {
        inputs: [],
        name: "ReentrancyGuardReentrantCall",
        type: "error"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "guid",
            type: "bytes32"
          },
          {
            indexed: !1,
            internalType: "uint8",
            name: "kind",
            type: "uint8"
          }
        ],
        name: "MessageApplied",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "pass",
            type: "address"
          }
        ],
        name: "PassBound",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !1,
            internalType: "uint128",
            name: "gas",
            type: "uint128"
          }
        ],
        name: "RedemptionGasRaised",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "guid",
            type: "bytes32"
          },
          {
            indexed: !0,
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          }
        ],
        name: "RedemptionSent",
        type: "event"
      },
      {
        inputs: [],
        name: "SUI_EID",
        outputs: [
          {
            internalType: "uint32",
            name: "",
            type: "uint32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "uint32",
                name: "srcEid",
                type: "uint32"
              },
              {
                internalType: "bytes32",
                name: "sender",
                type: "bytes32"
              },
              {
                internalType: "uint64",
                name: "nonce",
                type: "uint64"
              }
            ],
            internalType: "struct Origin",
            name: "origin",
            type: "tuple"
          }
        ],
        name: "allowInitializePath",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "backingNFT",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "contract TreeSuitePass",
            name: "p",
            type: "address"
          }
        ],
        name: "bindPass",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "binder",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        name: "delivered",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "endpoint",
        outputs: [
          {
            internalType: "contract ILayerZeroEndpointV2",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "uint32",
                name: "srcEid",
                type: "uint32"
              },
              {
                internalType: "bytes32",
                name: "sender",
                type: "bytes32"
              },
              {
                internalType: "uint64",
                name: "nonce",
                type: "uint64"
              }
            ],
            internalType: "struct Origin",
            name: "origin",
            type: "tuple"
          },
          {
            internalType: "bytes32",
            name: "guid",
            type: "bytes32"
          },
          {
            internalType: "bytes",
            name: "message",
            type: "bytes"
          },
          {
            internalType: "address",
            name: "",
            type: "address"
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes"
          }
        ],
        name: "lzReceive",
        outputs: [],
        stateMutability: "payable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint32",
            name: "",
            type: "uint32"
          },
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        name: "nextNonce",
        outputs: [
          {
            internalType: "uint64",
            name: "",
            type: "uint64"
          }
        ],
        stateMutability: "pure",
        type: "function"
      },
      {
        inputs: [],
        name: "pass",
        outputs: [
          {
            internalType: "contract TreeSuitePass",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "quoteRedemption",
        outputs: [
          {
            components: [
              {
                internalType: "uint256",
                name: "nativeFee",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "lzTokenFee",
                type: "uint256"
              }
            ],
            internalType: "struct MessagingFee",
            name: "",
            type: "tuple"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionGas",
        outputs: [
          {
            internalType: "uint128",
            name: "",
            type: "uint128"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionGuid",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionOptions",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionPayload",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionSent",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "route",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "sendRedemption",
        outputs: [
          {
            components: [
              {
                internalType: "bytes32",
                name: "guid",
                type: "bytes32"
              },
              {
                internalType: "uint64",
                name: "nonce",
                type: "uint64"
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "nativeFee",
                    type: "uint256"
                  },
                  {
                    internalType: "uint256",
                    name: "lzTokenFee",
                    type: "uint256"
                  }
                ],
                internalType: "struct MessagingFee",
                name: "fee",
                type: "tuple"
              }
            ],
            internalType: "struct MessagingReceipt",
            name: "receipt",
            type: "tuple"
          }
        ],
        stateMutability: "payable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint128",
            name: "gas",
            type: "uint128"
          }
        ],
        name: "setRedemptionGas",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "suiPeer",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    creationBytecode: "0x60e0604052600280546001600160801b0319166301c9c380179055348015610025575f5ffd5b50604051611c04380380611c048339810160408190526100449161019f565b60015f5546603814158061006b5750731a44076050125825900e736c501f859c50fe728c3b155b80610074575081155b8061007d575080155b80610109575061759663ffffffff16731a44076050125825900e736c501f859c50fe728c6001600160a01b031663416ecebf6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156100dc573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061010091906101c1565b63ffffffff1614155b1561012757604051636dac6a0960e01b815260040160405180910390fd5b608082905260a08190523360c081905260405163ca5eb5e160e01b81526004810191909152731a44076050125825900e736c501f859c50fe728c9063ca5eb5e1906024015f604051808303815f87803b158015610182575f5ffd5b505af1158015610194573d5f5f3e3d5ffd5b5050505050506101eb565b5f5f604083850312156101b0575f5ffd5b505080516020909101519092909150565b5f602082840312156101d1575f5ffd5b815163ffffffff811681146101e4575f5ffd5b9392505050565b60805160a05160c0516119a961025b5f395f818161030401528181610658015281816109490152610e6401525f81816103b301528181610501015281816107260152610bca01525f818161018e01528181610a8b01528181610f74015281816110c201526113c601526119a95ff3fe60806040526004361061011b575f3560e01c806383d5f21d1161009d578063ce26d6fe11610062578063ce26d6fe1461038d578063d96661ef146103a2578063e495f1d4146103d5578063eca463d414610400578063ff7bd03d14610414575f5ffd5b806383d5f21d146102aa578063a7a1ed72146102d4578063acba7b42146102f3578063b418b62214610326578063bbd6c9741461035d575f5ffd5b8063277e2bc6116100e3578063277e2bc6146101d35780634a8b412d146101f25780635e280f111461021357806378360c88146102525780637d25a05e14610272575f5ffd5b80630cd3c95b1461011f57806310265fa51461014957806313137d651461016a57806315aff54e1461017d57806323eba1c2146101be575b5f5ffd5b34801561012a575f5ffd5b50610133610433565b60405161014091906114b3565b60405180910390f35b348015610154575f5ffd5b506101686101633660046114e3565b61064d565b005b610168610178366004611559565b610a44565b348015610188575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b604051908152602001610140565b3480156101c9575f5ffd5b506101b060035481565b3480156101de575f5ffd5b506101686101ed3660046115f5565b610e59565b3480156101fd575f5ffd5b50610206610f25565b604051610140919061161b565b34801561021e575f5ffd5b5061023a731a44076050125825900e736c501f859c50fe728c81565b6040516001600160a01b039091168152602001610140565b34801561025d575f5ffd5b506101b05f5160206119545f395f51905f5281565b34801561027d575f5ffd5b5061029161028c366004611645565b61106e565b60405167ffffffffffffffff9091168152602001610140565b3480156102b5575f5ffd5b506102bf6176aa81565b60405163ffffffff9091168152602001610140565b3480156102df575f5ffd5b5060015461023a906001600160a01b031681565b3480156102fe575f5ffd5b5061023a7f000000000000000000000000000000000000000000000000000000000000000081565b348015610331575f5ffd5b50600254610345906001600160801b031681565b6040516001600160801b039091168152602001610140565b348015610368575f5ffd5b5060025461037d90600160801b900460ff1681565b6040519015158152602001610140565b610395611076565b604051610140919061166d565b3480156103ad575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b3480156103e0575f5ffd5b506101b06103ef3660046116af565b60046020525f908152604090205481565b34801561040b575f5ffd5b5061013361135a565b34801561041f575f5ffd5b5061037d61042e3660046116c6565b6113a5565b6001546060906001600160a01b031615806104c957506001546040805163c19d93fb60e01b815290516003926001600160a01b03169163c19d93fb9160048083019260209291908290030181865afa158015610491573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104b591906116f4565b60048111156104c6576104c66116e0565b14155b156104e757604051636dac6a0960e01b815260040160405180910390fd5b60015460408051635467e0a760e01b8152905160029283927f0000000000000000000000000000000000000000000000000000000000000000925f5160206119545f395f51905f52926001600160a01b031691635467e0a79160048083019260209291908290030181865afa158015610562573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105869190611712565b60015f9054906101000a90046001600160a01b03166001600160a01b03166366d003ac6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156105d6573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105fa9190611712565b6040516001600160f81b031960f897881b811660208301529590961b9094166021860152602285019290925260428401526062830152608282015260a2015b604051602081830303815290604052905090565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614158061068f57506001546001600160a01b031615155b806106a257506001600160a01b0381163b155b8061071e5750306001600160a01b0316816001600160a01b03166303eadcfc6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156106ee573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107129190611729565b6001600160a01b031614155b806107a857507f0000000000000000000000000000000000000000000000000000000000000000816001600160a01b031663d96661ef6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610781573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107a59190611712565b14155b8061082157505f5160206119545f395f51905f525f1b816001600160a01b03166378360c886040518163ffffffff1660e01b8152600401602060405180830381865afa1580156107fa573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061081e9190611712565b14155b806108b157507355d398326f99059ff775485246999027b31979556001600160a01b0316816001600160a01b031663e5a6b10f6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610881573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906108a59190611729565b6001600160a01b031614155b80610941575073c440f06bbc7e58b0d055815f915447e4ae0e37206001600160a01b0316816001600160a01b03166361d027b36040518163ffffffff1660e01b8152600401602060405180830381865afa158015610911573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109359190611729565b6001600160a01b031614155b806109dd57507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316816001600160a01b031663f77c47916040518163ffffffff1660e01b8152600401602060405180830381865afa1580156109ad573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109d19190611729565b6001600160a01b031614155b156109fb57604051636dac6a0960e01b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b0383169081179091556040517f3916d079df018feca66a550908f671cff67410227b4a8c24f13531847e12b9c8905f90a250565b610a4c611407565b33731a44076050125825900e736c501f859c50fe728c141580610a8357506176aa610a7a6020890189611744565b63ffffffff1614155b80610ab257507f0000000000000000000000000000000000000000000000000000000000000000876020013514155b80610ac657506001546001600160a01b0316155b80610acf575085155b80610ad957503415155b15610af757604051636dac6a0960e01b815260040160405180910390fd5b608284141580610b22575084845f818110610b1457610b1461175d565b9091013560f81c6002141590505b15610b4057604051636dac6a0960e01b815260040160405180910390fd5b5f85856001818110610b5457610b5461175d565b919091013560f81c91505f9050610b6f60226002888a611771565b610b7891611798565b90505f610b8960426022898b611771565b610b9291611798565b90505f610ba3606260428a8c611771565b610bac91611798565b90505f610bbd608260628b8d611771565b610bc691611798565b90507f000000000000000000000000000000000000000000000000000000000000000084141580610c0457505f5160206119545f395f51905f528314155b80610c6957508460ff16600114610c4a578460ff16600314610c27576001610c69565b610c3760608d0160408e016117ca565b67ffffffffffffffff1660021415610c69565b610c5a60608d0160408e016117ca565b67ffffffffffffffff16600114155b15610c8757604051636dac6a0960e01b815260040160405180910390fd5b5f8a8a604051610c989291906117e5565b60408051918290039091205f8e81526004602052919091205490915015610cf1575f8c8152600460205260409020548114610ce657604051636dac6a0960e01b815260040160405180910390fd5b505050505050610e47565b8560ff16600103610d8d5782151580610d0957508115155b15610d2757604051636dac6a0960e01b815260040160405180910390fd5b60015460405163838c037d60e01b815260048101879052602481018690526001600160a01b039091169063838c037d906044015b5f604051808303815f87803b158015610d72575f5ffd5b505af1158015610d84573d5f5f3e3d5ffd5b50505050610df7565b8560ff16600303610dde57600154604051631402390560e01b8152600481018790526024810186905260448101859052606481018490526001600160a01b0390911690631402390590608401610d5b565b604051636dac6a0960e01b815260040160405180910390fd5b5f8c815260046020908152604091829020839055905160ff881681528d917f176250b792ff8febc09040b8cf326ac55711559470d02712a12ae9a19a937cff910160405180910390a25050505050505b610e5060015f55565b50505050505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016141580610e9f57506002546001600160801b03908116908216105b80610eb35750600254600160801b900460ff165b15610ed157604051636dac6a0960e01b815260040160405180910390fd5b600280546001600160801b0319166001600160801b0383169081179091556040519081527f5421f9e2eb4b8dcb84b2372e7b4738e911e44f84c2969e270d4fe8ed9508bd839060200160405180910390a150565b604080518082019091525f8082526020820152600254600160801b900460ff1615610f6357604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f91731a44076050125825900e736c501f859c50fe728c9163ddc28c58918101610fc0610433565b8152602001610fcd61135a565b81525f6020909101526040516001600160e01b031960e084901b168152610ff9919030906004016117f4565b6040805180830381865afa158015611013573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061103791906118c5565b8051909150158061104b5750602081015115155b1561106957604051636dac6a0960e01b815260040160405180910390fd5b919050565b5f5b92915050565b61107e61142f565b611086611407565b600254600160801b900460ff16156110b157604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f9181016110f2610433565b81526020016110ff61135a565b81525f6020909101819052604051631bb8518b60e31b815291925090731a44076050125825900e736c501f859c50fe728c9063ddc28c589061114790859030906004016117f4565b6040805180830381865afa158015611161573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061118591906118c5565b805190915015806111995750602081015115155b806111a5575080513414155b156111c357604051636dac6a0960e01b815260040160405180910390fd5b6002805460ff60801b1916600160801b1790556040516302637a4560e41b8152731a44076050125825900e736c501f859c50fe728c90632637a45090349061121190869033906004016117f4565b60806040518083038185885af115801561122d573d5f5f3e3d5ffd5b50505050506040513d601f19601f8201168201806040525081019061125291906118df565b805190935015806112725750826020015167ffffffffffffffff16600114155b80611284575060408301516020015115155b80611293575060408301515134105b156112b157604051636dac6a0960e01b815260040160405180910390fd5b825160035560015460408051635467e0a760e01b815290516001600160a01b0390921691635467e0a7916004808201926020929091908290030181865afa1580156112fe573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906113229190611712565b83516040517fbe157cadcafc070b0baf6c5ad9a9e640a9ace6d1c96b5d1b1702286e16697477905f90a3505061135760015f55565b90565b600254604051600360f01b6020820152600160f81b60228201819052601160f01b6023830152602582015260809190911b6001600160801b0319166026820152606090603601610639565b5f6176aa6113b66020840184611744565b63ffffffff161480156113ec57507f00000000000000000000000000000000000000000000000000000000000000008260200135145b801561107057506001546001600160a01b0316151592915050565b60025f540361142957604051633ee5aeb560e01b815260040160405180910390fd5b60025f55565b60405180606001604052805f81526020015f67ffffffffffffffff16815260200161146b60405180604001604052805f81526020015f81525090565b905290565b5f81518084525f5b8181101561149457602081850181015186830182015201611478565b505f602082860101526020601f19601f83011685010191505092915050565b602081525f6114c56020830184611470565b9392505050565b6001600160a01b03811681146114e0575f5ffd5b50565b5f602082840312156114f3575f5ffd5b81356114c5816114cc565b5f6060828403121561150e575f5ffd5b50919050565b5f5f83601f840112611524575f5ffd5b50813567ffffffffffffffff81111561153b575f5ffd5b602083019150836020828501011115611552575f5ffd5b9250929050565b5f5f5f5f5f5f5f60e0888a03121561156f575f5ffd5b61157989896114fe565b965060608801359550608088013567ffffffffffffffff81111561159b575f5ffd5b6115a78a828b01611514565b90965094505060a08801356115bb816114cc565b925060c088013567ffffffffffffffff8111156115d6575f5ffd5b6115e28a828b01611514565b989b979a50959850939692959293505050565b5f60208284031215611605575f5ffd5b81356001600160801b03811681146114c5575f5ffd5b815181526020808301519082015260408101611070565b803563ffffffff81168114611069575f5ffd5b5f5f60408385031215611656575f5ffd5b61165f83611632565b946020939093013593505050565b5f6080820190508251825267ffffffffffffffff602084015116602083015260408301516116a8604084018280518252602090810151910152565b5092915050565b5f602082840312156116bf575f5ffd5b5035919050565b5f606082840312156116d6575f5ffd5b6114c583836114fe565b634e487b7160e01b5f52602160045260245ffd5b5f60208284031215611704575f5ffd5b8151600581106114c5575f5ffd5b5f60208284031215611722575f5ffd5b5051919050565b5f60208284031215611739575f5ffd5b81516114c5816114cc565b5f60208284031215611754575f5ffd5b6114c582611632565b634e487b7160e01b5f52603260045260245ffd5b5f5f8585111561177f575f5ffd5b8386111561178b575f5ffd5b5050820193919092039150565b80356020831015611070575f19602084900360031b1b1692915050565b67ffffffffffffffff811681146114e0575f5ffd5b5f602082840312156117da575f5ffd5b81356114c5816117b5565b818382375f9101908152919050565b6040815263ffffffff8351166040820152602083015160608201525f604084015160a0608084015261182960e0840182611470565b90506060850151603f198483030160a08501526118468282611470565b60809690960151151560c08501525050506001600160a01b039190911660209091015290565b5f6040828403121561187c575f5ffd5b6040805190810167ffffffffffffffff811182821017156118ab57634e487b7160e01b5f52604160045260245ffd5b604052825181526020928301519281019290925250919050565b5f604082840312156118d5575f5ffd5b6114c5838361186c565b5f60808284031280156118f0575f5ffd5b506040516060810167ffffffffffffffff8111828210171561192057634e487b7160e01b5f52604160045260245ffd5b604052825181526020830151611935816117b5565b6020820152611947846040850161186c565b6040820152939250505056fe046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa2646970667358221220f48aab856c9f5452bdabc498826f600f3cb80ff119a53ab662849ac52f01116464736f6c634300081e0033",
    runtimeTemplate: "0x60806040526004361061011b575f3560e01c806383d5f21d1161009d578063ce26d6fe11610062578063ce26d6fe1461038d578063d96661ef146103a2578063e495f1d4146103d5578063eca463d414610400578063ff7bd03d14610414575f5ffd5b806383d5f21d146102aa578063a7a1ed72146102d4578063acba7b42146102f3578063b418b62214610326578063bbd6c9741461035d575f5ffd5b8063277e2bc6116100e3578063277e2bc6146101d35780634a8b412d146101f25780635e280f111461021357806378360c88146102525780637d25a05e14610272575f5ffd5b80630cd3c95b1461011f57806310265fa51461014957806313137d651461016a57806315aff54e1461017d57806323eba1c2146101be575b5f5ffd5b34801561012a575f5ffd5b50610133610433565b60405161014091906114b3565b60405180910390f35b348015610154575f5ffd5b506101686101633660046114e3565b61064d565b005b610168610178366004611559565b610a44565b348015610188575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b604051908152602001610140565b3480156101c9575f5ffd5b506101b060035481565b3480156101de575f5ffd5b506101686101ed3660046115f5565b610e59565b3480156101fd575f5ffd5b50610206610f25565b604051610140919061161b565b34801561021e575f5ffd5b5061023a731a44076050125825900e736c501f859c50fe728c81565b6040516001600160a01b039091168152602001610140565b34801561025d575f5ffd5b506101b05f5160206119545f395f51905f5281565b34801561027d575f5ffd5b5061029161028c366004611645565b61106e565b60405167ffffffffffffffff9091168152602001610140565b3480156102b5575f5ffd5b506102bf6176aa81565b60405163ffffffff9091168152602001610140565b3480156102df575f5ffd5b5060015461023a906001600160a01b031681565b3480156102fe575f5ffd5b5061023a7f000000000000000000000000000000000000000000000000000000000000000081565b348015610331575f5ffd5b50600254610345906001600160801b031681565b6040516001600160801b039091168152602001610140565b348015610368575f5ffd5b5060025461037d90600160801b900460ff1681565b6040519015158152602001610140565b610395611076565b604051610140919061166d565b3480156103ad575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b3480156103e0575f5ffd5b506101b06103ef3660046116af565b60046020525f908152604090205481565b34801561040b575f5ffd5b5061013361135a565b34801561041f575f5ffd5b5061037d61042e3660046116c6565b6113a5565b6001546060906001600160a01b031615806104c957506001546040805163c19d93fb60e01b815290516003926001600160a01b03169163c19d93fb9160048083019260209291908290030181865afa158015610491573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104b591906116f4565b60048111156104c6576104c66116e0565b14155b156104e757604051636dac6a0960e01b815260040160405180910390fd5b60015460408051635467e0a760e01b8152905160029283927f0000000000000000000000000000000000000000000000000000000000000000925f5160206119545f395f51905f52926001600160a01b031691635467e0a79160048083019260209291908290030181865afa158015610562573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105869190611712565b60015f9054906101000a90046001600160a01b03166001600160a01b03166366d003ac6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156105d6573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105fa9190611712565b6040516001600160f81b031960f897881b811660208301529590961b9094166021860152602285019290925260428401526062830152608282015260a2015b604051602081830303815290604052905090565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614158061068f57506001546001600160a01b031615155b806106a257506001600160a01b0381163b155b8061071e5750306001600160a01b0316816001600160a01b03166303eadcfc6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156106ee573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107129190611729565b6001600160a01b031614155b806107a857507f0000000000000000000000000000000000000000000000000000000000000000816001600160a01b031663d96661ef6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610781573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107a59190611712565b14155b8061082157505f5160206119545f395f51905f525f1b816001600160a01b03166378360c886040518163ffffffff1660e01b8152600401602060405180830381865afa1580156107fa573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061081e9190611712565b14155b806108b157507355d398326f99059ff775485246999027b31979556001600160a01b0316816001600160a01b031663e5a6b10f6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610881573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906108a59190611729565b6001600160a01b031614155b80610941575073c440f06bbc7e58b0d055815f915447e4ae0e37206001600160a01b0316816001600160a01b03166361d027b36040518163ffffffff1660e01b8152600401602060405180830381865afa158015610911573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109359190611729565b6001600160a01b031614155b806109dd57507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316816001600160a01b031663f77c47916040518163ffffffff1660e01b8152600401602060405180830381865afa1580156109ad573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109d19190611729565b6001600160a01b031614155b156109fb57604051636dac6a0960e01b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b0383169081179091556040517f3916d079df018feca66a550908f671cff67410227b4a8c24f13531847e12b9c8905f90a250565b610a4c611407565b33731a44076050125825900e736c501f859c50fe728c141580610a8357506176aa610a7a6020890189611744565b63ffffffff1614155b80610ab257507f0000000000000000000000000000000000000000000000000000000000000000876020013514155b80610ac657506001546001600160a01b0316155b80610acf575085155b80610ad957503415155b15610af757604051636dac6a0960e01b815260040160405180910390fd5b608284141580610b22575084845f818110610b1457610b1461175d565b9091013560f81c6002141590505b15610b4057604051636dac6a0960e01b815260040160405180910390fd5b5f85856001818110610b5457610b5461175d565b919091013560f81c91505f9050610b6f60226002888a611771565b610b7891611798565b90505f610b8960426022898b611771565b610b9291611798565b90505f610ba3606260428a8c611771565b610bac91611798565b90505f610bbd608260628b8d611771565b610bc691611798565b90507f000000000000000000000000000000000000000000000000000000000000000084141580610c0457505f5160206119545f395f51905f528314155b80610c6957508460ff16600114610c4a578460ff16600314610c27576001610c69565b610c3760608d0160408e016117ca565b67ffffffffffffffff1660021415610c69565b610c5a60608d0160408e016117ca565b67ffffffffffffffff16600114155b15610c8757604051636dac6a0960e01b815260040160405180910390fd5b5f8a8a604051610c989291906117e5565b60408051918290039091205f8e81526004602052919091205490915015610cf1575f8c8152600460205260409020548114610ce657604051636dac6a0960e01b815260040160405180910390fd5b505050505050610e47565b8560ff16600103610d8d5782151580610d0957508115155b15610d2757604051636dac6a0960e01b815260040160405180910390fd5b60015460405163838c037d60e01b815260048101879052602481018690526001600160a01b039091169063838c037d906044015b5f604051808303815f87803b158015610d72575f5ffd5b505af1158015610d84573d5f5f3e3d5ffd5b50505050610df7565b8560ff16600303610dde57600154604051631402390560e01b8152600481018790526024810186905260448101859052606481018490526001600160a01b0390911690631402390590608401610d5b565b604051636dac6a0960e01b815260040160405180910390fd5b5f8c815260046020908152604091829020839055905160ff881681528d917f176250b792ff8febc09040b8cf326ac55711559470d02712a12ae9a19a937cff910160405180910390a25050505050505b610e5060015f55565b50505050505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016141580610e9f57506002546001600160801b03908116908216105b80610eb35750600254600160801b900460ff165b15610ed157604051636dac6a0960e01b815260040160405180910390fd5b600280546001600160801b0319166001600160801b0383169081179091556040519081527f5421f9e2eb4b8dcb84b2372e7b4738e911e44f84c2969e270d4fe8ed9508bd839060200160405180910390a150565b604080518082019091525f8082526020820152600254600160801b900460ff1615610f6357604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f91731a44076050125825900e736c501f859c50fe728c9163ddc28c58918101610fc0610433565b8152602001610fcd61135a565b81525f6020909101526040516001600160e01b031960e084901b168152610ff9919030906004016117f4565b6040805180830381865afa158015611013573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061103791906118c5565b8051909150158061104b5750602081015115155b1561106957604051636dac6a0960e01b815260040160405180910390fd5b919050565b5f5b92915050565b61107e61142f565b611086611407565b600254600160801b900460ff16156110b157604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f9181016110f2610433565b81526020016110ff61135a565b81525f6020909101819052604051631bb8518b60e31b815291925090731a44076050125825900e736c501f859c50fe728c9063ddc28c589061114790859030906004016117f4565b6040805180830381865afa158015611161573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061118591906118c5565b805190915015806111995750602081015115155b806111a5575080513414155b156111c357604051636dac6a0960e01b815260040160405180910390fd5b6002805460ff60801b1916600160801b1790556040516302637a4560e41b8152731a44076050125825900e736c501f859c50fe728c90632637a45090349061121190869033906004016117f4565b60806040518083038185885af115801561122d573d5f5f3e3d5ffd5b50505050506040513d601f19601f8201168201806040525081019061125291906118df565b805190935015806112725750826020015167ffffffffffffffff16600114155b80611284575060408301516020015115155b80611293575060408301515134105b156112b157604051636dac6a0960e01b815260040160405180910390fd5b825160035560015460408051635467e0a760e01b815290516001600160a01b0390921691635467e0a7916004808201926020929091908290030181865afa1580156112fe573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906113229190611712565b83516040517fbe157cadcafc070b0baf6c5ad9a9e640a9ace6d1c96b5d1b1702286e16697477905f90a3505061135760015f55565b90565b600254604051600360f01b6020820152600160f81b60228201819052601160f01b6023830152602582015260809190911b6001600160801b0319166026820152606090603601610639565b5f6176aa6113b66020840184611744565b63ffffffff161480156113ec57507f00000000000000000000000000000000000000000000000000000000000000008260200135145b801561107057506001546001600160a01b0316151592915050565b60025f540361142957604051633ee5aeb560e01b815260040160405180910390fd5b60025f55565b60405180606001604052805f81526020015f67ffffffffffffffff16815260200161146b60405180604001604052805f81526020015f81525090565b905290565b5f81518084525f5b8181101561149457602081850181015186830182015201611478565b505f602082860101526020601f19601f83011685010191505092915050565b602081525f6114c56020830184611470565b9392505050565b6001600160a01b03811681146114e0575f5ffd5b50565b5f602082840312156114f3575f5ffd5b81356114c5816114cc565b5f6060828403121561150e575f5ffd5b50919050565b5f5f83601f840112611524575f5ffd5b50813567ffffffffffffffff81111561153b575f5ffd5b602083019150836020828501011115611552575f5ffd5b9250929050565b5f5f5f5f5f5f5f60e0888a03121561156f575f5ffd5b61157989896114fe565b965060608801359550608088013567ffffffffffffffff81111561159b575f5ffd5b6115a78a828b01611514565b90965094505060a08801356115bb816114cc565b925060c088013567ffffffffffffffff8111156115d6575f5ffd5b6115e28a828b01611514565b989b979a50959850939692959293505050565b5f60208284031215611605575f5ffd5b81356001600160801b03811681146114c5575f5ffd5b815181526020808301519082015260408101611070565b803563ffffffff81168114611069575f5ffd5b5f5f60408385031215611656575f5ffd5b61165f83611632565b946020939093013593505050565b5f6080820190508251825267ffffffffffffffff602084015116602083015260408301516116a8604084018280518252602090810151910152565b5092915050565b5f602082840312156116bf575f5ffd5b5035919050565b5f606082840312156116d6575f5ffd5b6114c583836114fe565b634e487b7160e01b5f52602160045260245ffd5b5f60208284031215611704575f5ffd5b8151600581106114c5575f5ffd5b5f60208284031215611722575f5ffd5b5051919050565b5f60208284031215611739575f5ffd5b81516114c5816114cc565b5f60208284031215611754575f5ffd5b6114c582611632565b634e487b7160e01b5f52603260045260245ffd5b5f5f8585111561177f575f5ffd5b8386111561178b575f5ffd5b5050820193919092039150565b80356020831015611070575f19602084900360031b1b1692915050565b67ffffffffffffffff811681146114e0575f5ffd5b5f602082840312156117da575f5ffd5b81356114c5816117b5565b818382375f9101908152919050565b6040815263ffffffff8351166040820152602083015160608201525f604084015160a0608084015261182960e0840182611470565b90506060850151603f198483030160a08501526118468282611470565b60809690960151151560c08501525050506001600160a01b039190911660209091015290565b5f6040828403121561187c575f5ffd5b6040805190810167ffffffffffffffff811182821017156118ab57634e487b7160e01b5f52604160045260245ffd5b604052825181526020928301519281019290925250919050565b5f604082840312156118d5575f5ffd5b6114c5838361186c565b5f60808284031280156118f0575f5ffd5b506040516060810167ffffffffffffffff8111828210171561192057634e487b7160e01b5f52604160045260245ffd5b604052825181526020830151611935816117b5565b6020820152611947846040850161186c565b6040820152939250505056fe046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa2646970667358221220f48aab856c9f5452bdabc498826f600f3cb80ff119a53ab662849ac52f01116464736f6c634300081e0033",
    immutableReferences: {
      61: [
        {
          length: 32,
          start: 398
        },
        {
          length: 32,
          start: 2699
        },
        {
          length: 32,
          start: 3956
        },
        {
          length: 32,
          start: 4290
        },
        {
          length: 32,
          start: 5062
        }
      ],
      63: [
        {
          length: 32,
          start: 947
        },
        {
          length: 32,
          start: 1281
        },
        {
          length: 32,
          start: 1830
        },
        {
          length: 32,
          start: 3018
        }
      ],
      65: [
        {
          length: 32,
          start: 772
        },
        {
          length: 32,
          start: 1624
        },
        {
          length: 32,
          start: 2377
        },
        {
          length: 32,
          start: 3684
        }
      ]
    }
  }
}, Sn = {
  contracts: sd
}, rd = "0x1d3da001E586a7DEFD397B77FADB29eD6F039c13", id = "0xe969a6c0eba78468776b97d1e98cfc9e3f5b3d2cbd91903bee10de48d1e5e717", ms = {
  bnbPass: rd,
  bnbPassDigest: id
}, od = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", cd = "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4", dd = "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", fd = "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c", ud = "0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab", ld = "AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ", bd = "0x2bea9fd423d794de83f04c18381dc345ebf008d0a845a425ccb5c919beeca0ca", Pe = {
  publicationDigest: od,
  packagePeerIdentity: cd,
  nft: dd,
  vault: fd,
  bnbAdapter: ud,
  slotDigest: ld,
  bnbAdapterDigest: bd
}, pd = "0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae", md = {
  from: pd
}, gd = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", hd = "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4", Ad = "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", yd = "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c", wd = "AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ", mt = {
  publicationDigest: gd,
  packagePeerIdentity: hd,
  nft: Ad,
  vault: yd,
  slotDigest: wd
}, vd = "0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae", Td = "0x1a44076050125825900e736c501f859c50fe728c", gs = {
  from: vd,
  endpoint: Td
}, Id = /^(?!.*(^(?!@)|[-.@])($|[-.@]))(?:[a-z0-9-]{0,63}(?:\.[a-z0-9-]{0,63})*)?@[a-z0-9-]{0,63}$/i, Od = /^(?!.*(^|[-.])($|[-.]))(?:[a-z0-9-]{0,63}\.)+sui$/i, Ed = 235;
function Sd(e) {
  return e.length > Ed ? !1 : e.includes("@") ? Id.test(e) : Od.test(e);
}
const kd = /^([a-z0-9]+(?:-[a-z0-9]+)*)$/, Nd = /^\d+$/, Cd = 64, oi = "/", Dt = (e) => {
  const t = e.split(oi);
  if (t.length < 2 || t.length > 3) return !1;
  const [n, a, s] = t;
  return s !== void 0 && !Nd.test(s) || !Sd(n) ? !1 : kd.test(a) && a.length < Cd;
}, xd = (e) => {
  const t = e.split(/::|<|>|,/);
  for (const n of t) if (n.includes(oi) && !Dt(n)) return !1;
  return pi(e);
};
function on(e) {
  let t = BigInt(e);
  const n = [];
  let a = 0;
  if (t === 0n) return [0];
  for (; t > 0; )
    n[a] = Number(t & 127n), t >>= 7n, t > 0n && (n[a] |= 128), a += 1;
  return n;
}
function _d(e) {
  let t = 0n, n = 0n, a = 0;
  for (; ; ) {
    if (a >= e.length) throw new Error("ULEB decode error: buffer overflow");
    const s = e[a];
    if (a += 1, t += BigInt(s & 127) << n, !(s & 128)) break;
    n += 7n;
  }
  if (t > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ULEB decode error: value exceeds MAX_SAFE_INTEGER");
  return {
    value: Number(t),
    length: a
  };
}
var Bd = class {
  /**
  * @param {Uint8Array} data Data to use as a buffer.
  */
  constructor(e) {
    this.bytePosition = 0, this.dataView = new DataView(e.buffer, e.byteOffset, e.byteLength);
  }
  /**
  * Shift current cursor position by `bytes`.
  *
  * @param {Number} bytes Number of bytes to
  * @returns {this} Self for possible chaining.
  */
  shift(e) {
    return this.bytePosition += e, this;
  }
  /**
  * Read U8 value from the buffer and shift cursor by 1.
  * @returns
  */
  read8() {
    const e = this.dataView.getUint8(this.bytePosition);
    return this.shift(1), e;
  }
  /**
  * Read U16 value from the buffer and shift cursor by 2.
  * @returns
  */
  read16() {
    const e = this.dataView.getUint16(this.bytePosition, !0);
    return this.shift(2), e;
  }
  /**
  * Read U32 value from the buffer and shift cursor by 4.
  * @returns
  */
  read32() {
    const e = this.dataView.getUint32(this.bytePosition, !0);
    return this.shift(4), e;
  }
  /**
  * Read U64 value from the buffer and shift cursor by 8.
  * @returns
  */
  read64() {
    const e = this.read32(), t = this.read32().toString(16) + e.toString(16).padStart(8, "0");
    return BigInt("0x" + t).toString(10);
  }
  /**
  * Read U128 value from the buffer and shift cursor by 16.
  */
  read128() {
    const e = BigInt(this.read64()), t = BigInt(this.read64()).toString(16) + e.toString(16).padStart(16, "0");
    return BigInt("0x" + t).toString(10);
  }
  /**
  * Read U128 value from the buffer and shift cursor by 32.
  * @returns
  */
  read256() {
    const e = BigInt(this.read128()), t = BigInt(this.read128()).toString(16) + e.toString(16).padStart(32, "0");
    return BigInt("0x" + t).toString(10);
  }
  /**
  * Read `num` number of bytes from the buffer and shift cursor by `num`.
  * @param num Number of bytes to read.
  */
  readBytes(e) {
    const t = this.bytePosition + this.dataView.byteOffset, n = new Uint8Array(this.dataView.buffer, t, e);
    return this.shift(e), n;
  }
  /**
  * Read ULEB value - an integer of varying size. Used for enum indexes and
  * vector lengths.
  * @returns {Number} The ULEB value.
  */
  readULEB() {
    const e = this.bytePosition + this.dataView.byteOffset, { value: t, length: n } = _d(new Uint8Array(this.dataView.buffer, e));
    return this.shift(n), t;
  }
  /**
  * Read a BCS vector: read a length and then apply function `cb` X times
  * where X is the length of the vector, defined as ULEB in BCS bytes.
  * @param cb Callback to process elements of vector.
  * @returns {Array<Any>} Array of the resulting values, returned by callback.
  */
  readVec(e) {
    const t = this.readULEB(), n = [];
    for (let a = 0; a < t; a++) n.push(e(this, a, t));
    return n;
  }
};
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const jd = (e) => Object.freeze(e());
function Md(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in e && e.BYTES_PER_ELEMENT === 1;
}
function hs(e) {
  if (!Md(e))
    throw new TypeError("Uint8Array expected");
}
function Rd(e, t) {
  if (typeof t != "string")
    throw new TypeError(`${e}: string expected`);
  return !0;
}
function Dd(...e) {
  const t = (r) => r, n = (r, i) => (o) => r(i(o)), a = e.map((r) => r.encode).reduceRight(n, t), s = e.map((r) => r.decode).reduce(n, t);
  return { encode: a, decode: s };
}
const As = /* @__PURE__ */ (() => {
  try {
    const e = new TextDecoder();
    return e.decode(Uint8Array.of(65, 48, 43, 127)) === "A0+" ? e : void 0;
  } catch {
    return;
  }
})(), $n = 8192;
function Ud(e) {
  const t = e.length;
  if (As !== void 0 && t >= 12)
    return As.decode(e);
  if (t <= $n)
    return String.fromCharCode.apply(null, e);
  let n = "";
  for (let a = 0; a < t; a += $n)
    n += String.fromCharCode.apply(null, e.subarray(a, a + $n));
  return n;
}
function Pd(e, t) {
  const n = e.length;
  if (n > 128)
    throw new Error("alphabet: max 128 letters");
  const a = new Uint8Array(n), s = new Int8Array(128).fill(-1);
  for (let r = 0; r < n; r++) {
    const i = e.charCodeAt(r);
    if (e.codePointAt(r) !== i || i > 127)
      throw new Error("alphabet: single-char ASCII letters only");
    a[r] = i, s[i] = r;
  }
  if (t !== void 0)
    for (const r of Object.keys(t)) {
      const i = r.charCodeAt(0), o = s[t[r].charCodeAt(0)];
      if (r.length !== 1 || i > 127 || o === void 0 || o === -1)
        throw new Error(`alphabet: invalid alias ${r}`);
      s[i] = o;
    }
  return {
    encode: (r) => {
      const i = new Uint8Array(r.length);
      for (let o = 0; o < r.length; o++) {
        const c = r[o], u = a[c];
        if (u === void 0)
          throw new Error(`alphabet.encode: invalid digit ${c}`);
        i[o] = u;
      }
      return Ud(i);
    },
    decode: (r) => {
      Rd("decode", r);
      const i = r.length, o = new Uint8Array(i);
      for (let c = 0; c < i; c++) {
        const u = r.charCodeAt(c), f = u < 128 ? s[u] : -1;
        if (f === -1)
          throw new Error(`Unknown letter "${r[c]}". Allowed: ${e}`);
        o[c] = f;
      }
      return o;
    }
  };
}
const ys = 656356768, Vd = {
  encode: (e) => {
    hs(e);
    const t = e.length;
    if (t === 0)
      return new Uint8Array(0);
    let n = 0;
    for (; n < t - 1 && e[n] === 0; )
      n++;
    const a = Math.ceil(t / 2), s = new Uint16Array(a), r = t & 1;
    r && (s[0] = e[0]);
    for (let b = r, g = r; b < t; b += 2, g++)
      s[g] = e[b] << 8 | e[b + 1];
    const i = [];
    let o = 0;
    for (; o < a; ) {
      let b = 0;
      for (let g = o; g < a; g++) {
        const m = b * 65536 + s[g], p = Math.floor(m / ys);
        b = m - p * ys, s[g] = p, p === 0 && g === o && o++;
      }
      i.push(b);
    }
    const c = i.length - 1;
    let u = c * 5;
    for (let b = i[c]; u++, !(b < 58); b = Math.floor(b / 58))
      ;
    const f = new Uint8Array(n + u);
    let l = f.length - 1;
    for (let b = 0; b < c; b++) {
      let g = i[b];
      for (let m = 0; m < 5; m++)
        f[l--] = g % 58, g = Math.floor(g / 58);
    }
    for (let b = i[c]; l >= n; b = Math.floor(b / 58))
      f[l--] = b % 58;
    return f;
  },
  decode: (e) => {
    hs(e);
    const t = e.length;
    if (t === 0)
      return new Uint8Array(0);
    if (t >= 65536)
      throw new Error("invalid length");
    let n = 0;
    for (; n < t - 1 && e[n] === 0; )
      n++;
    const a = new Uint16Array(Math.ceil(t * 6 / 16) + 1);
    let s = 0, r = 0, i = t % 5 || 5;
    for (; r < t; ) {
      let f = 0, l = 1;
      for (const g = r + i; r < g; r++) {
        const m = e[r];
        if (m >= 58)
          throw new Error(`invalid integer: ${m}`);
        f = f * 58 + m, l *= 58;
      }
      i = 5;
      let b = f;
      for (let g = 0; g < s; g++) {
        const m = a[g] * l + b;
        b = Math.floor(m / 65536), a[g] = m - b * 65536;
      }
      for (; b > 0; b = Math.floor(b / 65536))
        a[s++] = b % 65536;
    }
    const o = s === 0 ? 1 : s * 2 - (a[s - 1] < 256 ? 1 : 0), c = new Uint8Array(n + o);
    let u = c.length - 1;
    for (let f = 0; f < s; f++) {
      const l = a[f];
      c[u--] = l & 255, u >= n && (c[u--] = l >> 8);
    }
    return c;
  }
}, Fd = (e) => Dd(Vd, Pd(e)), ci = /* @__PURE__ */ jd(() => Fd("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")), Ut = (e) => ci.encode(e), Nt = (e) => ci.decode(e);
function j0(e) {
  return Uint8Array.from(atob(e), (t) => t.charCodeAt(0));
}
const Ln = 8192;
function I0(e) {
  if (e.length < Ln) return btoa(String.fromCharCode(...e));
  let t = "";
  for (var n = 0; n < e.length; n += Ln) {
    const a = e.slice(n, n + Ln);
    t += String.fromCharCode(...a);
  }
  return btoa(t);
}
function Ma(e) {
  const t = e.startsWith("0x") ? e.slice(2) : e, n = t.length % 2 === 0 ? t : `0${t}`, a = n.match(/[0-9a-fA-F]{2}/g)?.map((s) => parseInt(s, 16)) ?? [];
  if (a.length !== n.length / 2) throw new Error(`Invalid hex string ${e}`);
  return Uint8Array.from(a);
}
function Ae(e) {
  return e.reduce((t, n) => t + n.toString(16).padStart(2, "0"), "");
}
function $d(e, t) {
  switch (t) {
    case "base58":
      return Ut(e);
    case "base64":
      return I0(e);
    case "hex":
      return Ae(e);
    default:
      throw new Error("Unsupported encoding, supported values are: base64, hex");
  }
}
function di(e, t = ["<", ">"]) {
  const [n, a] = t, s = [];
  let r = "", i = 0;
  for (let o = 0; o < e.length; o++) {
    const c = e[o];
    if (c === n && i++, c === a && i--, i === 0 && c === ",") {
      s.push(r.trim()), r = "";
      continue;
    }
    r += c;
  }
  return s.push(r.trim()), s;
}
var Ld = class {
  constructor({ initialSize: e = 1024, maxSize: t = 1 / 0, allocateSize: n = 1024 } = {}) {
    this.bytePosition = 0, this.size = e, this.maxSize = t, this.allocateSize = n, this.dataView = new DataView(new ArrayBuffer(e));
  }
  ensureSizeOrGrow(e) {
    const t = this.bytePosition + e;
    if (t > this.size) {
      const n = Math.min(this.maxSize, Math.max(this.size + t, this.size + this.allocateSize));
      if (t > n) throw new Error(`Attempting to serialize to BCS, but buffer does not have enough size. Allocated size: ${this.size}, Max size: ${this.maxSize}, Required size: ${t}`);
      this.size = n;
      const a = new ArrayBuffer(this.size);
      new Uint8Array(a).set(new Uint8Array(this.dataView.buffer)), this.dataView = new DataView(a);
    }
  }
  /**
  * Shift current cursor position by `bytes`.
  *
  * @param {Number} bytes Number of bytes to
  * @returns {this} Self for possible chaining.
  */
  shift(e) {
    return this.bytePosition += e, this;
  }
  /**
  * Write a U8 value into a buffer and shift cursor position by 1.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  write8(e) {
    return this.ensureSizeOrGrow(1), this.dataView.setUint8(this.bytePosition, Number(e)), this.shift(1);
  }
  /**
  * Write a U8 value into a buffer and shift cursor position by 1.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  writeBytes(e) {
    this.ensureSizeOrGrow(e.length);
    for (let t = 0; t < e.length; t++) this.dataView.setUint8(this.bytePosition + t, e[t]);
    return this.shift(e.length);
  }
  /**
  * Write a U16 value into a buffer and shift cursor position by 2.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  write16(e) {
    return this.ensureSizeOrGrow(2), this.dataView.setUint16(this.bytePosition, Number(e), !0), this.shift(2);
  }
  /**
  * Write a U32 value into a buffer and shift cursor position by 4.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  write32(e) {
    return this.ensureSizeOrGrow(4), this.dataView.setUint32(this.bytePosition, Number(e), !0), this.shift(4);
  }
  /**
  * Write a U64 value into a buffer and shift cursor position by 8.
  * @param {bigint} value Value to write.
  * @returns {this}
  */
  write64(e) {
    return zn(BigInt(e), 8).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a U128 value into a buffer and shift cursor position by 16.
  *
  * @param {bigint} value Value to write.
  * @returns {this}
  */
  write128(e) {
    return zn(BigInt(e), 16).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a U256 value into a buffer and shift cursor position by 16.
  *
  * @param {bigint} value Value to write.
  * @returns {this}
  */
  write256(e) {
    return zn(BigInt(e), 32).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a ULEB value into a buffer and shift cursor position by number of bytes
  * written.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  writeULEB(e) {
    return on(e).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a vector into a buffer by first writing the vector length and then calling
  * a callback on each passed value.
  *
  * @param {Array<Any>} vector Array of elements to write.
  * @param {WriteVecCb} cb Callback to call on each element of the vector.
  * @returns {this}
  */
  writeVec(e, t) {
    return this.writeULEB(e.length), Array.from(e).forEach((n, a) => t(this, n, a, e.length)), this;
  }
  /**
  * Adds support for iterations over the object.
  * @returns {Uint8Array}
  */
  *[Symbol.iterator]() {
    for (let e = 0; e < this.bytePosition; e++) yield this.dataView.getUint8(e);
    return this.toBytes();
  }
  /**
  * Get underlying buffer taking only value bytes (in case initial buffer size was bigger).
  * @returns {Uint8Array} Resulting bcs.
  */
  toBytes() {
    return new Uint8Array(this.dataView.buffer.slice(0, this.bytePosition));
  }
  /**
  * Represent data as 'hex' or 'base64'
  * @param encoding Encoding to use: 'base64' or 'hex'
  */
  toString(e) {
    return $d(this.toBytes(), e);
  }
};
function zn(e, t) {
  const n = new Uint8Array(t);
  let a = 0;
  for (; e > 0; )
    n[a] = Number(e % BigInt(256)), e = e / BigInt(256), a += 1;
  return n;
}
var q0 = class fi {
  #n;
  #e;
  constructor(t) {
    this.name = t.name, this.read = t.read, this.serializedSize = t.serializedSize ?? (() => null), this.#n = t.write, this.#e = t.serialize ?? ((n, a) => {
      const s = new Ld({
        initialSize: this.serializedSize(n) ?? void 0,
        ...a
      });
      return this.#n(n, s), s.toBytes();
    }), this.validate = t.validate ?? (() => {
    });
  }
  write(t, n) {
    this.validate(t), this.#n(t, n);
  }
  serialize(t, n) {
    return this.validate(t), new zd(this, this.#e(t, n));
  }
  parse(t) {
    const n = new Bd(t);
    return this.read(n);
  }
  fromHex(t) {
    return this.parse(Ma(t));
  }
  fromBase58(t) {
    return this.parse(Nt(t));
  }
  fromBase64(t) {
    return this.parse(j0(t));
  }
  transform({ name: t, input: n, output: a, validate: s }) {
    return new fi({
      name: t ?? this.name,
      read: (r) => a ? a(this.read(r)) : this.read(r),
      write: (r, i) => this.#n(n ? n(r) : r, i),
      serializedSize: (r) => this.serializedSize(n ? n(r) : r),
      serialize: (r, i) => this.#e(n ? n(r) : r, i),
      validate: (r) => {
        s?.(r), this.validate(n ? n(r) : r);
      }
    });
  }
};
const ui = Symbol.for("@mysten/serialized-bcs");
function ua(e) {
  return !!e && typeof e == "object" && e[ui] === !0;
}
var zd = class {
  #n;
  #e;
  get [ui]() {
    return !0;
  }
  constructor(e, t) {
    this.#n = e, this.#e = t;
  }
  toBytes() {
    return this.#e;
  }
  toHex() {
    return Ae(this.#e);
  }
  toBase64() {
    return I0(this.#e);
  }
  toBase58() {
    return Ut(this.#e);
  }
  parse() {
    return this.#n.parse(this.#e);
  }
};
function cn({ size: e, ...t }) {
  return new q0({
    ...t,
    serializedSize: () => e
  });
}
function Gn({ readMethod: e, writeMethod: t, ...n }) {
  return cn({
    ...n,
    read: (a) => a[e](),
    write: (a, s) => s[t](a),
    validate: (a) => {
      if (a < 0 || a > n.maxValue) throw new TypeError(`Invalid ${n.name} value: ${a}. Expected value in range 0-${n.maxValue}`);
      n.validate?.(a);
    }
  });
}
function Wn({ readMethod: e, writeMethod: t, ...n }) {
  return cn({
    ...n,
    read: (a) => a[e](),
    write: (a, s) => s[t](BigInt(a)),
    validate: (a) => {
      const s = BigInt(a);
      if (s < 0 || s > n.maxValue) throw new TypeError(`Invalid ${n.name} value: ${s}. Expected value in range 0-${n.maxValue}`);
      n.validate?.(s);
    }
  });
}
function Gd({ serialize: e, ...t }) {
  const n = new q0({
    ...t,
    serialize: e,
    write: (a, s) => {
      for (const r of n.serialize(a).toBytes()) s.write8(r);
    }
  });
  return n;
}
function Wd({ toBytes: e, fromBytes: t, ...n }) {
  return new q0({
    ...n,
    read: (a) => {
      const s = a.readULEB();
      return t(a.readBytes(s));
    },
    write: (a, s) => {
      const r = e(a);
      s.writeULEB(r.length);
      for (let i = 0; i < r.length; i++) s.write8(r[i]);
    },
    serialize: (a) => {
      const s = e(a), r = on(s.length), i = new Uint8Array(r.length + s.length);
      return i.set(r, 0), i.set(s, r.length), i;
    },
    validate: (a) => {
      if (typeof a != "string") throw new TypeError(`Invalid ${n.name} value: ${a}. Expected string`);
      n.validate?.(a);
    }
  });
}
function Qd(e) {
  let t = null;
  function n() {
    return t || (t = e()), t;
  }
  return new q0({
    name: "lazy",
    read: (a) => n().read(a),
    serializedSize: (a) => n().serializedSize(a),
    write: (a, s) => n().write(a, s),
    serialize: (a, s) => n().serialize(a, s).toBytes()
  });
}
var Jd = class extends q0 {
  constructor({ name: e, fields: t, ...n }) {
    const a = Object.entries(t);
    super({
      name: e,
      serializedSize: (s) => {
        let r = 0;
        for (const [i, o] of a) {
          const c = o.serializedSize(s[i]);
          if (c == null) return null;
          r += c;
        }
        return r;
      },
      read: (s) => {
        const r = {};
        for (const [i, o] of a) r[i] = o.read(s);
        return r;
      },
      write: (s, r) => {
        for (const [i, o] of a) o.write(s[i], r);
      },
      ...n,
      validate: (s) => {
        if (n?.validate?.(s), typeof s != "object" || s == null) throw new TypeError(`Expected object, found ${typeof s}`);
      }
    });
  }
}, Yd = class extends q0 {
  constructor({ fields: e, ...t }) {
    const n = Object.entries(e);
    super({
      read: (a) => {
        const s = a.readULEB(), r = n[s];
        if (!r) throw new TypeError(`Unknown value ${s} for enum ${t.name}`);
        const [i, o] = r;
        return {
          [i]: o?.read(a) ?? !0,
          $kind: i
        };
      },
      write: (a, s) => {
        const [r, i] = Object.entries(a).filter(([o]) => Object.hasOwn(e, o))[0];
        for (let o = 0; o < n.length; o++) {
          const [c, u] = n[o];
          if (c === r) {
            s.writeULEB(o), u?.write(i, s);
            return;
          }
        }
      },
      ...t,
      validate: (a) => {
        if (t?.validate?.(a), typeof a != "object" || a == null) throw new TypeError(`Expected object, found ${typeof a}`);
        const s = Object.keys(a).filter((i) => a[i] !== void 0 && Object.hasOwn(e, i));
        if (s.length !== 1) throw new TypeError(`Expected object with one key, but found ${s.length} for type ${t.name}}`);
        const [r] = s;
        if (!Object.hasOwn(e, r)) throw new TypeError(`Invalid enum variant ${r}`);
      }
    });
  }
}, Zd = class extends q0 {
  constructor({ fields: e, name: t, ...n }) {
    super({
      name: t ?? `(${e.map((a) => a.name).join(", ")})`,
      serializedSize: (a) => {
        let s = 0;
        for (let r = 0; r < e.length; r++) {
          const i = e[r].serializedSize(a[r]);
          if (i == null) return null;
          s += i;
        }
        return s;
      },
      read: (a) => {
        const s = [];
        for (const r of e) s.push(r.read(a));
        return s;
      },
      write: (a, s) => {
        for (let r = 0; r < e.length; r++) e[r].write(a[r], s);
      },
      ...n,
      validate: (a) => {
        if (n?.validate?.(a), !Array.isArray(a)) throw new TypeError(`Expected array, found ${typeof a}`);
        if (a.length !== e.length) throw new TypeError(`Expected array of length ${e.length}, found ${a.length}`);
      }
    });
  }
};
function qd(e, t, n) {
  return new q0({
    read: (a) => {
      const s = new Array(e);
      for (let r = 0; r < e; r++) s[r] = t.read(a);
      return s;
    },
    write: (a, s) => {
      for (const r of a) t.write(r, s);
    },
    ...n,
    name: n?.name ?? `${t.name}[${e}]`,
    validate: (a) => {
      if (n?.validate?.(a), !a || typeof a != "object" || !("length" in a)) throw new TypeError(`Expected array, found ${typeof a}`);
      if (a.length !== e) throw new TypeError(`Expected array of length ${e}, found ${a.length}`);
    }
  });
}
function Hd(e) {
  return d.enum(`Option<${e.name}>`, {
    None: null,
    Some: e
  }).transform({
    input: (t) => t == null ? { None: !0 } : { Some: t },
    output: (t) => t.$kind === "Some" ? t.Some : null
  });
}
function Xd(e, t) {
  return new q0({
    read: (n) => {
      const a = n.readULEB(), s = new Array(a);
      for (let r = 0; r < a; r++) s[r] = e.read(n);
      return s;
    },
    write: (n, a) => {
      a.writeULEB(n.length);
      for (const s of n) e.write(s, a);
    },
    ...t,
    name: t?.name ?? `vector<${e.name}>`,
    validate: (n) => {
      if (t?.validate?.(n), !n || typeof n != "object" || !("length" in n)) throw new TypeError(`Expected array, found ${typeof n}`);
    }
  });
}
function Kd(e, t) {
  for (let n = 0; n < Math.min(e.length, t.length); n++) if (e[n] !== t[n]) return e[n] - t[n];
  return e.length - t.length;
}
function ef(e, t) {
  return new q0({
    name: `Map<${e.name}, ${t.name}>`,
    read: (n) => {
      const a = n.readULEB(), s = /* @__PURE__ */ new Map();
      for (let r = 0; r < a; r++) s.set(e.read(n), t.read(n));
      return s;
    },
    write: (n, a) => {
      const s = [...n.entries()].map(([r, i]) => [e.serialize(r).toBytes(), i]);
      s.sort(([r], [i]) => Kd(r, i)), a.writeULEB(s.length);
      for (const [r, i] of s)
        a.writeBytes(r), t.write(i, a);
    }
  });
}
const d = {
  u8(e) {
    return Gn({
      readMethod: "read8",
      writeMethod: "write8",
      size: 1,
      maxValue: 2 ** 8 - 1,
      ...e,
      name: e?.name ?? "u8"
    });
  },
  u16(e) {
    return Gn({
      readMethod: "read16",
      writeMethod: "write16",
      size: 2,
      maxValue: 2 ** 16 - 1,
      ...e,
      name: e?.name ?? "u16"
    });
  },
  u32(e) {
    return Gn({
      readMethod: "read32",
      writeMethod: "write32",
      size: 4,
      maxValue: 2 ** 32 - 1,
      ...e,
      name: e?.name ?? "u32"
    });
  },
  u64(e) {
    return Wn({
      readMethod: "read64",
      writeMethod: "write64",
      size: 8,
      maxValue: 2n ** 64n - 1n,
      ...e,
      name: e?.name ?? "u64"
    });
  },
  u128(e) {
    return Wn({
      readMethod: "read128",
      writeMethod: "write128",
      size: 16,
      maxValue: 2n ** 128n - 1n,
      ...e,
      name: e?.name ?? "u128"
    });
  },
  u256(e) {
    return Wn({
      readMethod: "read256",
      writeMethod: "write256",
      size: 32,
      maxValue: 2n ** 256n - 1n,
      ...e,
      name: e?.name ?? "u256"
    });
  },
  bool(e) {
    return cn({
      size: 1,
      read: (t) => t.read8() === 1,
      write: (t, n) => n.write8(t ? 1 : 0),
      ...e,
      name: e?.name ?? "bool",
      validate: (t) => {
        if (e?.validate?.(t), typeof t != "boolean") throw new TypeError(`Expected boolean, found ${typeof t}`);
      }
    });
  },
  uleb128(e) {
    return Gd({
      read: (t) => t.readULEB(),
      serialize: (t) => Uint8Array.from(on(t)),
      ...e,
      name: e?.name ?? "uleb128"
    });
  },
  bytes(e, t) {
    return cn({
      size: e,
      read: (n) => n.readBytes(e),
      write: (n, a) => {
        a.writeBytes(new Uint8Array(n));
      },
      ...t,
      name: t?.name ?? `bytes[${e}]`,
      validate: (n) => {
        if (t?.validate?.(n), !n || typeof n != "object" || !("length" in n)) throw new TypeError(`Expected array, found ${typeof n}`);
        if (n.length !== e) throw new TypeError(`Expected array of length ${e}, found ${n.length}`);
      }
    });
  },
  byteVector(e) {
    return new q0({
      read: (t) => {
        const n = t.readULEB();
        return t.readBytes(n);
      },
      write: (t, n) => {
        const a = new Uint8Array(t);
        n.writeULEB(a.length), n.writeBytes(a);
      },
      ...e,
      name: e?.name ?? "vector<u8>",
      serializedSize: (t) => {
        const n = "length" in t ? t.length : null;
        return n == null ? null : on(n).length + n;
      },
      validate: (t) => {
        if (e?.validate?.(t), !t || typeof t != "object" || !("length" in t)) throw new TypeError(`Expected array, found ${typeof t}`);
      }
    });
  },
  string(e) {
    return Wd({
      toBytes: (t) => new TextEncoder().encode(t),
      fromBytes: (t) => new TextDecoder().decode(t),
      ...e,
      name: e?.name ?? "string"
    });
  },
  fixedArray: qd,
  option: Hd,
  vector: Xd,
  tuple(e, t) {
    return new Zd({
      fields: e,
      ...t
    });
  },
  struct(e, t, n) {
    return new Jd({
      name: e,
      fields: t,
      ...n
    });
  },
  enum(e, t, n) {
    return new Yd({
      name: e,
      fields: t,
      ...n
    });
  },
  map: ef,
  lazy(e) {
    return Qd(e);
  }
}, kn = 32;
function Ct(e) {
  return sf(e) && rf(e) === kn;
}
const tf = /^[a-zA-Z][a-zA-Z0-9_]*$/;
function ws(e) {
  return tf.test(e);
}
const nf = [
  "bool",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "u256",
  "address",
  "signer"
], af = /^vector<(.+)>$/;
function li(e) {
  if (nf.includes(e)) return !0;
  const t = e.match(af);
  return t ? li(t[1]) : e.includes("::") ? pi(e) : !1;
}
function bi(e) {
  return !Ct(e.address) && !Dt(e.address) || !ws(e.module) || !ws(e.name) ? !1 : e.typeParams.every((t) => typeof t == "string" ? li(t) : bi(t));
}
function pi(e) {
  try {
    return bi(je(e));
  } catch {
    return !1;
  }
}
function mi(e) {
  if (e.startsWith("vector<")) {
    if (!e.endsWith(">")) throw new Error(`Invalid type tag: ${e}`);
    const t = e.slice(7, -1);
    if (!t) throw new Error(`Invalid type tag: ${e}`);
    const n = mi(t);
    return typeof n == "string" ? `vector<${n}>` : `vector<${Z0(n)}>`;
  }
  return e.includes("::") ? je(e) : e;
}
function je(e) {
  const t = e.split("::");
  if (t.length < 3) throw new Error(`Invalid struct tag: ${e}`);
  const [n, a] = t;
  if (!n || !a) throw new Error(`Invalid struct tag: ${e}`);
  const s = Dt(n), r = e.slice(n.length + a.length + 4), i = r.includes("<") ? r.slice(0, r.indexOf("<")) : r;
  if (!i || r.includes("<") && !r.endsWith(">")) throw new Error(`Invalid struct tag: ${e}`);
  const o = r.includes("<") ? di(r.slice(r.indexOf("<") + 1, r.lastIndexOf(">"))).map((c) => mi(c.trim())) : [];
  return {
    address: s ? n : j(n),
    module: a,
    name: i,
    typeParams: o
  };
}
function Z0(e) {
  if (typeof e == "string" && e.startsWith("vector<")) throw new Error("normalizeStructTag does not support vector types. Use normalizeTypeTag instead.");
  const { address: t, module: n, name: a, typeParams: s } = typeof e == "string" ? je(e) : e;
  return `${t}::${n}::${a}${s?.length > 0 ? `<${s.map((r) => typeof r == "string" ? r : Z0(r)).join(",")}>` : ""}`;
}
function j(e, t = !1) {
  let n = e.toLowerCase();
  return !t && n.startsWith("0x") && (n = n.slice(2)), `0x${n.padStart(kn * 2, "0")}`;
}
function la(e, t = !1) {
  return j(e, t);
}
function sf(e) {
  return /^(0x|0X)?[a-fA-F0-9]+$/.test(e) && e.length % 2 === 0;
}
function rf(e) {
  return /^(0x|0X)/.test(e) ? (e.length - 2) / 2 : e.length / 2;
}
const of = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function gi(e) {
  return of;
}
let cf;
// @__NO_SIDE_EFFECTS__
function df(e) {
  return cf?.get(e);
}
let ff;
// @__NO_SIDE_EFFECTS__
function uf(e) {
  return ff?.get(e);
}
let lf;
// @__NO_SIDE_EFFECTS__
function bf(e, t) {
  return lf?.get(e)?.get(t);
}
// @__NO_SIDE_EFFECTS__
function Ra(e) {
  const t = typeof e;
  return t === "string" ? `"${e}"` : t === "number" || t === "bigint" || t === "boolean" ? `${e}` : t === "object" || t === "function" ? (e && Object.getPrototypeOf(e)?.constructor?.name) ?? "null" : t;
}
function O0(e, t, n, a, s) {
  const r = s && "input" in s ? s.input : n.value, i = s?.expected ?? e.expects ?? null, o = s?.received ?? /* @__PURE__ */ Ra(r), c = {
    kind: e.kind,
    type: e.type,
    input: r,
    expected: i,
    received: o,
    message: `Invalid ${t}: ${i ? `Expected ${i} but r` : "R"}eceived ${o}`,
    requirement: e.requirement,
    path: s?.path,
    issues: s?.issues,
    lang: a.lang,
    abortEarly: a.abortEarly,
    abortPipeEarly: a.abortPipeEarly
  }, u = e.kind === "schema", f = s?.message ?? e.message ?? /* @__PURE__ */ bf(e.reference, c.lang) ?? (u ? /* @__PURE__ */ uf(c.lang) : null) ?? a.message ?? /* @__PURE__ */ df(c.lang);
  f !== void 0 && (c.message = typeof f == "function" ? f(c) : f), u && (n.typed = !1), n.issues ? n.issues.push(c) : n.issues = [c];
}
const vs = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function h0(e) {
  let t = vs.get(e);
  return t || (t = {
    version: 1,
    vendor: "valibot",
    validate(n) {
      return e["~run"]({ value: n }, /* @__PURE__ */ gi());
    }
  }, vs.set(e, t)), t;
}
// @__NO_SIDE_EFFECTS__
function pf(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t) && t !== "__proto__" && t !== "prototype" && t !== "constructor";
}
// @__NO_SIDE_EFFECTS__
function hi(e, t) {
  const n = [...new Set(e)];
  return n.length > 1 ? `(${n.join(` ${t} `)})` : n[0] ?? "never";
}
var mf = class extends Error {
  /**
  * Creates a Valibot error with useful information.
  *
  * @param issues The error issues.
  */
  constructor(e) {
    super(e[0].message), this.name = "ValiError", this.issues = e;
  }
};
// @__NO_SIDE_EFFECTS__
function Nn(e, t) {
  return {
    kind: "validation",
    type: "check",
    reference: Nn,
    async: !1,
    expects: null,
    requirement: e,
    message: t,
    "~run"(n, a) {
      return n.typed && !this.requirement(n.value) && O0(this, "input", n, a), n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function v0(e) {
  return {
    kind: "validation",
    type: "integer",
    reference: v0,
    async: !1,
    expects: null,
    requirement: Number.isInteger,
    message: e,
    "~run"(t, n) {
      return t.typed && !this.requirement(t.value) && O0(this, "integer", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Cn(e) {
  return {
    kind: "transformation",
    type: "transform",
    reference: Cn,
    async: !1,
    operation: e,
    "~run"(t) {
      return t.value = this.operation(t.value), t;
    }
  };
}
const gf = { abortEarly: !0 };
// @__NO_SIDE_EFFECTS__
function hf(e, t, n) {
  return typeof e.fallback == "function" ? e.fallback(t, n) : e.fallback;
}
// @__NO_SIDE_EFFECTS__
function xn(e, t, n) {
  return typeof e.default == "function" ? e.default(t, n) : e.default;
}
// @__NO_SIDE_EFFECTS__
function ba(e, t) {
  return !e["~run"]({ value: t }, gf).issues;
}
// @__NO_SIDE_EFFECTS__
function P(e, t) {
  return {
    kind: "schema",
    type: "array",
    reference: P,
    expects: "Array",
    async: !1,
    item: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      const s = n.value;
      if (Array.isArray(s)) {
        n.typed = !0, n.value = [];
        for (let r = 0; r < s.length; r++) {
          const i = s[r], o = this.item["~run"]({ value: i }, a);
          if (o.issues) {
            const c = {
              type: "array",
              origin: "value",
              input: s,
              key: r,
              value: i
            };
            for (const u of o.issues)
              u.path ? u.path.unshift(c) : u.path = [c], n.issues?.push(u);
            if (n.issues || (n.issues = o.issues), a.abortEarly) {
              n.typed = !1;
              break;
            }
          }
          o.typed || (n.typed = !1), n.value.push(o.value);
        }
      } else O0(this, "type", n, a);
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Da(e) {
  return {
    kind: "schema",
    type: "bigint",
    reference: Da,
    expects: "bigint",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "bigint" ? t.typed = !0 : O0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function rt(e) {
  return {
    kind: "schema",
    type: "boolean",
    reference: rt,
    expects: "boolean",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "boolean" ? t.typed = !0 : O0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function pa(e) {
  return {
    kind: "schema",
    type: "lazy",
    reference: pa,
    expects: "unknown",
    async: !1,
    getter: e,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(t, n) {
      return this.getter(t.value)["~run"](t, n);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function z(e, t) {
  return {
    kind: "schema",
    type: "literal",
    reference: z,
    expects: /* @__PURE__ */ Ra(e),
    async: !1,
    literal: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      return n.value === this.literal ? n.typed = !0 : O0(this, "type", n, a), n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Y(e, t) {
  return {
    kind: "schema",
    type: "nullable",
    reference: Y,
    expects: `(${e.expects} | null)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      return n.value === null && (this.default !== void 0 && (n.value = /* @__PURE__ */ xn(this, n, a)), n.value === null) ? (n.typed = !0, n) : this.wrapped["~run"](n, a);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function xt(e, t) {
  return {
    kind: "schema",
    type: "nullish",
    reference: xt,
    expects: `(${e.expects} | null | undefined)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      return (n.value === null || n.value === void 0) && (this.default !== void 0 && (n.value = /* @__PURE__ */ xn(this, n, a)), n.value === null || n.value === void 0) ? (n.typed = !0, n) : this.wrapped["~run"](n, a);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function T0(e) {
  return {
    kind: "schema",
    type: "number",
    reference: T0,
    expects: "number",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "number" && !isNaN(t.value) ? t.typed = !0 : O0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function N(e, t) {
  return {
    kind: "schema",
    type: "object",
    reference: N,
    expects: "Object",
    async: !1,
    entries: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      const s = n.value;
      if (s && typeof s == "object") {
        n.typed = !0, n.value = {};
        for (const r in this.entries) {
          const i = this.entries[r];
          if (r in s || (i.type === "exact_optional" || i.type === "optional" || i.type === "nullish") && i.default !== void 0) {
            const o = r in s ? s[r] : /* @__PURE__ */ xn(i), c = i["~run"]({ value: o }, a);
            if (c.issues) {
              const u = {
                type: "object",
                origin: "value",
                input: s,
                key: r,
                value: o
              };
              for (const f of c.issues)
                f.path ? f.path.unshift(u) : f.path = [u], n.issues?.push(f);
              if (n.issues || (n.issues = c.issues), a.abortEarly) {
                n.typed = !1;
                break;
              }
            }
            c.typed || (n.typed = !1), n.value[r] = c.value;
          } else if (i.fallback !== void 0) n.value[r] = /* @__PURE__ */ hf(i);
          else if (i.type !== "exact_optional" && i.type !== "optional" && i.type !== "nullish" && (O0(this, "key", n, a, {
            input: void 0,
            expected: `"${r}"`,
            path: [{
              type: "object",
              origin: "key",
              input: s,
              key: r,
              value: s[r]
            }]
          }), a.abortEarly))
            break;
        }
      } else O0(this, "type", n, a);
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function k0(e, t) {
  return {
    kind: "schema",
    type: "optional",
    reference: k0,
    expects: `(${e.expects} | undefined)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      return n.value === void 0 && (this.default !== void 0 && (n.value = /* @__PURE__ */ xn(this, n, a)), n.value === void 0) ? (n.typed = !0, n) : this.wrapped["~run"](n, a);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Ai(e, t) {
  return {
    kind: "schema",
    type: "picklist",
    reference: Ai,
    expects: /* @__PURE__ */ hi(e.map(Ra), "|"),
    async: !1,
    options: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      return this.options.includes(n.value) ? n.typed = !0 : O0(this, "type", n, a), n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function _t(e, t, n) {
  return {
    kind: "schema",
    type: "record",
    reference: _t,
    expects: "Object",
    async: !1,
    key: e,
    value: t,
    message: n,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(a, s) {
      const r = a.value;
      if (r && typeof r == "object") {
        a.typed = !0, a.value = {};
        for (const i in r) if (/* @__PURE__ */ pf(r, i)) {
          const o = r[i], c = this.key["~run"]({ value: i }, s);
          if (c.issues) {
            const f = {
              type: "object",
              origin: "key",
              input: r,
              key: i,
              value: o
            };
            for (const l of c.issues)
              l.path = [f], a.issues?.push(l);
            if (a.issues || (a.issues = c.issues), s.abortEarly) {
              a.typed = !1;
              break;
            }
          }
          const u = this.value["~run"]({ value: o }, s);
          if (u.issues) {
            const f = {
              type: "object",
              origin: "value",
              input: r,
              key: i,
              value: o
            };
            for (const l of u.issues)
              l.path ? l.path.unshift(f) : l.path = [f], a.issues?.push(l);
            if (a.issues || (a.issues = u.issues), s.abortEarly) {
              a.typed = !1;
              break;
            }
          }
          (!c.typed || !u.typed) && (a.typed = !1), c.typed && (a.value[c.value] = u.value);
        }
      } else O0(this, "type", a, s);
      return a;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function F(e) {
  return {
    kind: "schema",
    type: "string",
    reference: F,
    expects: "string",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "string" ? t.typed = !0 : O0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Ua(e, t) {
  return {
    kind: "schema",
    type: "tuple",
    reference: Ua,
    expects: "Array",
    async: !1,
    items: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      const s = n.value;
      if (Array.isArray(s)) {
        n.typed = !0, n.value = [];
        for (let r = 0; r < this.items.length; r++) {
          const i = s[r], o = this.items[r]["~run"]({ value: i }, a);
          if (o.issues) {
            const c = {
              type: "array",
              origin: "value",
              input: s,
              key: r,
              value: i
            };
            for (const u of o.issues)
              u.path ? u.path.unshift(c) : u.path = [c], n.issues?.push(u);
            if (n.issues || (n.issues = o.issues), a.abortEarly) {
              n.typed = !1;
              break;
            }
          }
          o.typed || (n.typed = !1), n.value.push(o.value);
        }
      } else O0(this, "type", n, a);
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Ts(e) {
  let t;
  if (e) for (const n of e) if (t) for (const a of n.issues) t.push(a);
  else t = n.issues;
  return t;
}
// @__NO_SIDE_EFFECTS__
function F0(e, t) {
  return {
    kind: "schema",
    type: "union",
    reference: F0,
    expects: /* @__PURE__ */ hi(e.map((n) => n.expects), "|"),
    async: !1,
    options: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(n, a) {
      let s, r, i;
      for (const o of this.options) {
        const c = o["~run"]({ value: n.value }, a);
        if (c.typed) if (c.issues) r ? r.push(c) : r = [c];
        else {
          s = c;
          break;
        }
        else i ? i.push(c) : i = [c];
      }
      if (s) return s;
      if (r) {
        if (r.length === 1) return r[0];
        O0(this, "type", n, a, { issues: /* @__PURE__ */ Ts(r) }), n.typed = !0;
      } else {
        if (i?.length === 1) return i[0];
        O0(this, "type", n, a, { issues: /* @__PURE__ */ Ts(i) });
      }
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Pt() {
  return {
    kind: "schema",
    type: "unknown",
    reference: Pt,
    expects: "unknown",
    async: !1,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(e) {
      return e.typed = !0, e;
    }
  };
}
function q(e, t, n) {
  const a = e["~run"]({ value: t }, /* @__PURE__ */ gi());
  if (a.issues) throw new mf(a.issues);
  return a.value;
}
// @__NO_SIDE_EFFECTS__
function m0(...e) {
  return {
    ...e[0],
    pipe: e,
    get "~standard"() {
      return /* @__PURE__ */ h0(this);
    },
    "~run"(t, n) {
      for (const a of e) if (a.kind !== "metadata") {
        if (t.issues && (a.kind === "schema" || a.kind === "transformation")) {
          t.typed = !1;
          break;
        }
        (!t.issues || !n.abortEarly && !n.abortPipeEarly) && (t = a["~run"](t, n));
      }
      return t;
    }
  };
}
function re(e) {
  return /* @__PURE__ */ F0(Object.keys(e).map((t) => At(t, /* @__PURE__ */ N({ [t]: e[t] }))));
}
function At(e, t) {
  return /* @__PURE__ */ m0(/* @__PURE__ */ N({
    ...t.entries,
    $kind: /* @__PURE__ */ k0(/* @__PURE__ */ z(e))
  }), /* @__PURE__ */ Cn((n) => ({
    ...n,
    $kind: e
  })));
}
const ft = /* @__PURE__ */ m0(/* @__PURE__ */ F(), /* @__PURE__ */ Cn((e) => j(e)), /* @__PURE__ */ Nn(Ct)), M0 = ft, Je = /* @__PURE__ */ F(), b0 = /* @__PURE__ */ m0(/* @__PURE__ */ F0([/* @__PURE__ */ F(), /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0())]), /* @__PURE__ */ Nn((e) => {
  try {
    return BigInt(e), BigInt(e) >= 0 && BigInt(e) <= 18446744073709551615n;
  } catch {
    return !1;
  }
}, "Invalid u64")), Af = /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0(), /* @__PURE__ */ Nn((e) => e >= 0 && e < 2 ** 32, "Invalid u32")), Me = /* @__PURE__ */ N({
  objectId: ft,
  version: b0,
  digest: /* @__PURE__ */ F()
}), H = /* @__PURE__ */ F0([
  At("GasCoin", /* @__PURE__ */ N({ GasCoin: /* @__PURE__ */ z(!0) })),
  At("Input", /* @__PURE__ */ N({
    Input: /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()),
    type: /* @__PURE__ */ k0(/* @__PURE__ */ F0([
      /* @__PURE__ */ z("pure"),
      /* @__PURE__ */ z("object"),
      /* @__PURE__ */ z("withdrawal")
    ]))
  })),
  At("Result", /* @__PURE__ */ N({ Result: /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()) })),
  At("NestedResult", /* @__PURE__ */ N({ NestedResult: /* @__PURE__ */ Ua([/* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()), /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0())]) }))
]), yf = /* @__PURE__ */ N({
  budget: /* @__PURE__ */ Y(b0),
  price: /* @__PURE__ */ Y(b0),
  owner: /* @__PURE__ */ Y(ft),
  payment: /* @__PURE__ */ Y(/* @__PURE__ */ P(Me))
}), ma = /* @__PURE__ */ F0([
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("address") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("bool") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("u8") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("u16") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("u32") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("u64") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("u128") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("u256") }),
  /* @__PURE__ */ N({ $kind: /* @__PURE__ */ z("unknown") }),
  /* @__PURE__ */ N({
    $kind: /* @__PURE__ */ z("vector"),
    vector: /* @__PURE__ */ pa(() => ma)
  }),
  /* @__PURE__ */ N({
    $kind: /* @__PURE__ */ z("datatype"),
    datatype: /* @__PURE__ */ N({
      typeName: /* @__PURE__ */ F(),
      typeParameters: /* @__PURE__ */ P(/* @__PURE__ */ pa(() => ma))
    })
  }),
  /* @__PURE__ */ N({
    $kind: /* @__PURE__ */ z("typeParameter"),
    index: /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0())
  })
]), wf = /* @__PURE__ */ N({
  reference: /* @__PURE__ */ Y(/* @__PURE__ */ F0([
    /* @__PURE__ */ z("mutable"),
    /* @__PURE__ */ z("immutable"),
    /* @__PURE__ */ z("unknown")
  ])),
  body: ma
}), vf = /* @__PURE__ */ N({
  package: M0,
  module: /* @__PURE__ */ F(),
  function: /* @__PURE__ */ F(),
  typeArguments: /* @__PURE__ */ P(/* @__PURE__ */ F()),
  arguments: /* @__PURE__ */ P(H),
  _argumentTypes: /* @__PURE__ */ k0(/* @__PURE__ */ Y(/* @__PURE__ */ P(wf)))
}), Tf = /* @__PURE__ */ N({
  name: /* @__PURE__ */ F(),
  inputs: /* @__PURE__ */ _t(/* @__PURE__ */ F(), /* @__PURE__ */ F0([H, /* @__PURE__ */ P(H)])),
  data: /* @__PURE__ */ _t(/* @__PURE__ */ F(), /* @__PURE__ */ Pt())
}), If = re({
  MoveCall: vf,
  TransferObjects: /* @__PURE__ */ N({
    objects: /* @__PURE__ */ P(H),
    address: H
  }),
  SplitCoins: /* @__PURE__ */ N({
    coin: H,
    amounts: /* @__PURE__ */ P(H)
  }),
  MergeCoins: /* @__PURE__ */ N({
    destination: H,
    sources: /* @__PURE__ */ P(H)
  }),
  Publish: /* @__PURE__ */ N({
    modules: /* @__PURE__ */ P(Je),
    dependencies: /* @__PURE__ */ P(M0)
  }),
  MakeMoveVec: /* @__PURE__ */ N({
    type: /* @__PURE__ */ Y(/* @__PURE__ */ F()),
    elements: /* @__PURE__ */ P(H)
  }),
  Upgrade: /* @__PURE__ */ N({
    modules: /* @__PURE__ */ P(Je),
    dependencies: /* @__PURE__ */ P(M0),
    package: M0,
    ticket: H
  }),
  $Intent: Tf
}), yi = re({
  ImmOrOwnedObject: Me,
  SharedObject: /* @__PURE__ */ N({
    objectId: M0,
    initialSharedVersion: b0,
    mutable: /* @__PURE__ */ rt()
  }),
  Receiving: Me
}), Of = re({ MaxAmountU64: b0 }), Ef = re({ Balance: /* @__PURE__ */ F() }), Sf = re({
  Sender: /* @__PURE__ */ z(!0),
  Sponsor: /* @__PURE__ */ z(!0)
}), wi = /* @__PURE__ */ N({
  reservation: Of,
  typeArg: Ef,
  withdrawFrom: Sf
}), kf = re({
  Object: yi,
  Pure: /* @__PURE__ */ N({ bytes: Je }),
  UnresolvedPure: /* @__PURE__ */ N({ value: /* @__PURE__ */ Pt() }),
  UnresolvedObject: /* @__PURE__ */ N({
    objectId: M0,
    version: /* @__PURE__ */ k0(/* @__PURE__ */ Y(b0)),
    digest: /* @__PURE__ */ k0(/* @__PURE__ */ Y(/* @__PURE__ */ F())),
    initialSharedVersion: /* @__PURE__ */ k0(/* @__PURE__ */ Y(b0)),
    mutable: /* @__PURE__ */ k0(/* @__PURE__ */ Y(/* @__PURE__ */ rt()))
  }),
  FundsWithdrawal: wi
}), Is = re({
  Object: yi,
  Pure: /* @__PURE__ */ N({ bytes: Je })
}), vi = /* @__PURE__ */ N({
  minEpoch: /* @__PURE__ */ Y(b0),
  maxEpoch: /* @__PURE__ */ Y(b0),
  minTimestamp: /* @__PURE__ */ Y(b0),
  maxTimestamp: /* @__PURE__ */ Y(b0),
  chain: /* @__PURE__ */ F(),
  nonce: Af
}), Ti = re({
  None: /* @__PURE__ */ z(!0),
  Epoch: b0,
  ValidDuring: vi
}), Kt = /* @__PURE__ */ N({
  version: /* @__PURE__ */ z(2),
  sender: /* @__PURE__ */ xt(ft),
  expiration: /* @__PURE__ */ xt(Ti),
  gasData: yf,
  inputs: /* @__PURE__ */ P(kf),
  commands: /* @__PURE__ */ P(If)
});
function dn(e) {
  if (typeof e == "string") return j(e);
  if (e.Object)
    return e.Object.ImmOrOwnedObject ? j(e.Object.ImmOrOwnedObject.objectId) : e.Object.Receiving ? j(e.Object.Receiving.objectId) : j(e.Object.SharedObject.objectId);
  if (e.UnresolvedObject) return j(e.UnresolvedObject.objectId);
}
function Nf(e, t, n) {
  const a = (s) => {
    switch (s.$kind) {
      case "Input": {
        const r = t.get(s.Input);
        if (r === void 0) throw new Error(`Input ${s.Input} not found in input mapping`);
        return {
          ...s,
          Input: r
        };
      }
      case "Result": {
        const r = n.get(s.Result);
        return r !== void 0 ? {
          ...s,
          Result: r
        } : s;
      }
      case "NestedResult": {
        const r = n.get(s.NestedResult[0]);
        return r !== void 0 ? {
          ...s,
          NestedResult: [r, s.NestedResult[1]]
        } : s;
      }
      default:
        return s;
    }
  };
  switch (e.$kind) {
    case "MoveCall":
      e.MoveCall.arguments = e.MoveCall.arguments.map(a);
      break;
    case "TransferObjects":
      e.TransferObjects.objects = e.TransferObjects.objects.map(a), e.TransferObjects.address = a(e.TransferObjects.address);
      break;
    case "SplitCoins":
      e.SplitCoins.coin = a(e.SplitCoins.coin), e.SplitCoins.amounts = e.SplitCoins.amounts.map(a);
      break;
    case "MergeCoins":
      e.MergeCoins.destination = a(e.MergeCoins.destination), e.MergeCoins.sources = e.MergeCoins.sources.map(a);
      break;
    case "MakeMoveVec":
      e.MakeMoveVec.elements = e.MakeMoveVec.elements.map(a);
      break;
    case "Upgrade":
      e.Upgrade.ticket = a(e.Upgrade.ticket);
      break;
    case "$Intent": {
      const s = e.$Intent.inputs;
      e.$Intent.inputs = {};
      for (const [r, i] of Object.entries(s)) e.$Intent.inputs[r] = Array.isArray(i) ? i.map(a) : a(i);
      break;
    }
  }
}
const Cf = /^vector<(.+)>$/, xf = /^([^:]+)::([^:]+)::([^<]+)(<(.+)>)?/;
var it = class et {
  static parseFromStr(t, n = !1) {
    if (t === "address") return { address: null };
    if (t === "bool") return { bool: null };
    if (t === "u8") return { u8: null };
    if (t === "u16") return { u16: null };
    if (t === "u32") return { u32: null };
    if (t === "u64") return { u64: null };
    if (t === "u128") return { u128: null };
    if (t === "u256") return { u256: null };
    if (t === "signer") return { signer: null };
    const a = t.match(Cf);
    if (a) return { vector: et.parseFromStr(a[1], n) };
    const s = t.match(xf);
    if (s) return { struct: {
      address: n ? j(s[1]) : s[1],
      module: s[2],
      name: s[3],
      typeParams: s[5] === void 0 ? [] : et.parseStructTypeArgs(s[5], n)
    } };
    throw new Error(`Encountered unexpected token when parsing type args for ${t}`);
  }
  static parseStructTypeArgs(t, n = !1) {
    return di(t).map((a) => et.parseFromStr(a, n));
  }
  static tagToString(t) {
    if ("bool" in t) return "bool";
    if ("u8" in t) return "u8";
    if ("u16" in t) return "u16";
    if ("u32" in t) return "u32";
    if ("u64" in t) return "u64";
    if ("u128" in t) return "u128";
    if ("u256" in t) return "u256";
    if ("address" in t) return "address";
    if ("signer" in t) return "signer";
    if ("vector" in t) return `vector<${et.tagToString(t.vector)}>`;
    if ("struct" in t) {
      const n = t.struct, a = n.typeParams.map(et.tagToString).join(", ");
      return `${n.address}::${n.module}::${n.name}${a ? `<${a}>` : ""}`;
    }
    throw new Error("Invalid TypeTag");
  }
};
function _f(e) {
  return d.u64({
    name: "unsafe_u64",
    ...e
  }).transform({
    input: (t) => t,
    output: (t) => Number(t)
  });
}
function Bf(e) {
  return d.enum("Option", {
    None: null,
    Some: e
  });
}
const R = d.bytes(kn).transform({
  validate: (e) => {
    const t = typeof e == "string" ? e : Ae(e);
    if (!t || !Ct(j(t))) throw new Error(`Invalid Sui address ${t}`);
  },
  input: (e) => typeof e == "string" ? Ma(j(e)) : e,
  output: (e) => j(Ae(e))
}), f0 = d.byteVector().transform({
  name: "ObjectDigest",
  input: (e) => Nt(e),
  output: (e) => Ut(new Uint8Array(e)),
  validate: (e) => {
    if (Nt(e).length !== 32) throw new Error("ObjectDigest must be 32 bytes");
  }
}), U0 = d.struct("SuiObjectRef", {
  objectId: R,
  version: d.u64(),
  digest: f0
}), Ii = d.struct("SharedObjectRef", {
  objectId: R,
  initialSharedVersion: d.u64(),
  mutable: d.bool()
}), Oi = d.enum("ObjectArg", {
  ImmOrOwnedObject: U0,
  SharedObject: Ii,
  Receiving: U0
}), ge = d.enum("Owner", {
  AddressOwner: R,
  ObjectOwner: R,
  Shared: d.struct("Shared", { initialSharedVersion: d.u64() }),
  Immutable: null,
  ConsensusAddressOwner: d.struct("ConsensusAddressOwner", {
    startVersion: d.u64(),
    owner: R
  })
}), jf = d.enum("Reservation", { MaxAmountU64: d.u64() }), Mf = d.enum("WithdrawalType", { Balance: d.lazy(() => Ze) }), Rf = d.enum("WithdrawFrom", {
  Sender: null,
  Sponsor: null
}), Df = d.struct("FundsWithdrawal", {
  reservation: jf,
  typeArg: Mf,
  withdrawFrom: Rf
}), Ei = d.enum("CallArg", {
  Pure: d.struct("Pure", { bytes: d.byteVector().transform({
    input: (e) => typeof e == "string" ? j0(e) : e,
    output: (e) => I0(new Uint8Array(e))
  }) }),
  Object: Oi,
  FundsWithdrawal: Df
}), Pa = d.enum("TypeTag", {
  bool: null,
  u8: null,
  u64: null,
  u128: null,
  address: null,
  signer: null,
  vector: d.lazy(() => Pa),
  struct: d.lazy(() => Va),
  u16: null,
  u32: null,
  u256: null
}), Ze = Pa.transform({
  input: (e) => typeof e == "string" ? it.parseFromStr(e, !0) : e,
  output: (e) => it.tagToString(e)
}), H0 = d.enum("Argument", {
  GasCoin: null,
  Input: d.u16(),
  Result: d.u16(),
  NestedResult: d.tuple([d.u16(), d.u16()])
}), Si = d.struct("ProgrammableMoveCall", {
  package: R,
  module: d.string(),
  function: d.string(),
  typeArguments: d.vector(Ze),
  arguments: d.vector(H0)
}), ki = d.enum("Command", {
  MoveCall: Si,
  TransferObjects: d.struct("TransferObjects", {
    objects: d.vector(H0),
    address: H0
  }),
  SplitCoins: d.struct("SplitCoins", {
    coin: H0,
    amounts: d.vector(H0)
  }),
  MergeCoins: d.struct("MergeCoins", {
    destination: H0,
    sources: d.vector(H0)
  }),
  Publish: d.struct("Publish", {
    modules: d.vector(d.byteVector().transform({
      input: (e) => typeof e == "string" ? j0(e) : e,
      output: (e) => I0(new Uint8Array(e))
    })),
    dependencies: d.vector(R)
  }),
  MakeMoveVec: d.struct("MakeMoveVec", {
    type: Bf(Ze).transform({
      input: (e) => e === null ? { None: !0 } : { Some: e },
      output: (e) => e.Some ?? null
    }),
    elements: d.vector(H0)
  }),
  Upgrade: d.struct("Upgrade", {
    modules: d.vector(d.byteVector().transform({
      input: (e) => typeof e == "string" ? j0(e) : e,
      output: (e) => I0(new Uint8Array(e))
    })),
    dependencies: d.vector(R),
    package: R,
    ticket: H0
  })
}), ga = d.struct("ProgrammableTransaction", {
  inputs: d.vector(Ei),
  commands: d.vector(ki)
}), Uf = d.struct("ValidDuring", {
  minEpoch: d.option(d.u64()),
  maxEpoch: d.option(d.u64()),
  minTimestamp: d.option(d.u64()),
  maxTimestamp: d.option(d.u64()),
  chain: f0,
  nonce: d.u32()
}), Ni = d.enum("TransactionExpiration", {
  None: null,
  Epoch: _f(),
  ValidDuring: Uf
}), Va = d.struct("StructTag", {
  address: R,
  module: d.string(),
  name: d.string(),
  typeParams: d.vector(Pa)
}), Ci = d.struct("GasData", {
  payment: d.vector(U0),
  owner: R,
  price: d.u64(),
  budget: d.u64()
}), xi = d.enum("IntentScope", {
  TransactionData: null,
  TransactionEffects: null,
  CheckpointSummary: null,
  PersonalMessage: null
}), _i = d.enum("IntentVersion", { V0: null }), Bi = d.enum("AppId", { Sui: null }), ji = d.struct("Intent", {
  scope: xi,
  version: _i,
  appId: Bi
});
function Mi(e) {
  return d.struct(`IntentMessage<${e.name}>`, {
    intent: ji,
    value: e
  });
}
const Ri = d.enum("CompressedSignature", {
  ED25519: d.bytes(64),
  Secp256k1: d.bytes(64),
  Secp256r1: d.bytes(64),
  ZkLogin: d.byteVector(),
  Passkey: d.byteVector()
}), Di = d.enum("PublicKey", {
  ED25519: d.bytes(32),
  Secp256k1: d.bytes(33),
  Secp256r1: d.bytes(33),
  ZkLogin: d.byteVector(),
  Passkey: d.bytes(33)
}), Ui = d.struct("MultiSigPkMap", {
  pubKey: Di,
  weight: d.u8()
}), Pi = d.struct("MultiSigPublicKey", {
  pk_map: d.vector(Ui),
  threshold: d.u16()
}), Pf = d.struct("MultiSig", {
  sigs: d.vector(Ri),
  bitmap: d.u16(),
  multisig_pk: Pi
}), Vf = d.byteVector().transform({
  input: (e) => typeof e == "string" ? j0(e) : e,
  output: (e) => I0(new Uint8Array(e))
}), Ff = d.struct("PasskeyAuthenticator", {
  authenticatorData: d.byteVector(),
  clientDataJson: d.string(),
  userSignature: d.byteVector()
}), Vi = d.enum("MoveObjectType", {
  Other: Va,
  GasCoin: null,
  StakedSui: null,
  Coin: Ze,
  AccumulatorBalanceWrapper: null
}), Fi = d.struct("TypeOrigin", {
  moduleName: d.string(),
  datatypeName: d.string(),
  package: R
}), $i = d.struct("UpgradeInfo", {
  upgradedId: R,
  upgradedVersion: d.u64()
}), Li = d.struct("MovePackage", {
  id: R,
  version: d.u64(),
  moduleMap: d.map(d.string(), d.byteVector()),
  typeOriginTable: d.vector(Fi),
  linkageTable: d.map(R, $i)
}), zi = d.struct("MoveObject", {
  type: Vi,
  hasPublicTransfer: d.bool(),
  version: d.u64(),
  contents: d.byteVector()
}), Fa = d.enum("Data", {
  Move: zi,
  Package: Li
}), $f = d.struct("ObjectInner", {
  data: Fa,
  owner: ge,
  previousTransaction: f0,
  storageRebate: d.u64()
}), Gi = d.struct("ChangeEpoch", {
  epoch: d.u64(),
  protocolVersion: d.u64(),
  storageCharge: d.u64(),
  computationCharge: d.u64(),
  storageRebate: d.u64(),
  nonRefundableStorageFee: d.u64(),
  epochStartTimestampMs: d.u64(),
  systemPackages: d.vector(d.tuple([
    d.u64(),
    d.vector(d.byteVector()),
    d.vector(R)
  ]))
}), Lf = d.enum("GenesisObject", { RawObject: d.struct("RawObject", {
  data: Fa,
  owner: ge
}) }), zf = d.struct("GenesisTransaction", { objects: d.vector(Lf) }), Gf = d.struct("ConsensusCommitPrologue", {
  epoch: d.u64(),
  round: d.u64(),
  commitTimestampMs: d.u64()
}), Wf = d.struct("ConsensusCommitPrologueV2", {
  epoch: d.u64(),
  round: d.u64(),
  commitTimestampMs: d.u64(),
  consensusCommitDigest: f0
}), Wi = d.enum("ConsensusDeterminedVersionAssignments", {
  CancelledTransactions: d.vector(d.tuple([f0, d.vector(d.tuple([R, d.u64()]))])),
  CancelledTransactionsV2: d.vector(d.tuple([f0, d.vector(d.tuple([d.tuple([R, d.u64()]), d.u64()]))]))
}), Qf = d.struct("ConsensusCommitPrologueV3", {
  epoch: d.u64(),
  round: d.u64(),
  subDagIndex: d.option(d.u64()),
  commitTimestampMs: d.u64(),
  consensusCommitDigest: f0,
  consensusDeterminedVersionAssignments: Wi
}), Jf = d.struct("ConsensusCommitPrologueV4", {
  epoch: d.u64(),
  round: d.u64(),
  subDagIndex: d.option(d.u64()),
  commitTimestampMs: d.u64(),
  consensusCommitDigest: f0,
  consensusDeterminedVersionAssignments: Wi,
  additionalStateDigest: f0
}), Yf = d.struct("ActiveJwk", {
  jwkId: d.struct("JwkId", {
    iss: d.string(),
    kid: d.string()
  }),
  jwk: d.struct("JWK", {
    kty: d.string(),
    e: d.string(),
    n: d.string(),
    alg: d.string()
  }),
  epoch: d.u64()
}), Zf = d.struct("AuthenticatorStateUpdate", {
  epoch: d.u64(),
  round: d.u64(),
  newActiveJwks: d.vector(Yf),
  authenticatorObjInitialSharedVersion: d.u64()
}), qf = d.struct("RandomnessStateUpdate", {
  epoch: d.u64(),
  randomnessRound: d.u64(),
  randomBytes: d.byteVector(),
  randomnessObjInitialSharedVersion: d.u64()
}), Hf = d.struct("AuthenticatorStateExpire", {
  minEpoch: d.u64(),
  authenticatorObjInitialSharedVersion: d.u64()
}), Xf = d.enum("ExecutionTimeObservationKey", {
  MoveEntryPoint: d.struct("MoveEntryPoint", {
    package: R,
    module: d.string(),
    function: d.string(),
    typeArguments: d.vector(Ze)
  }),
  TransferObjects: null,
  SplitCoins: null,
  MergeCoins: null,
  Publish: null,
  MakeMoveVec: null,
  Upgrade: null
}), Kf = d.enum("StoredExecutionTimeObservations", { V1: d.vector(d.tuple([Xf, d.vector(d.tuple([d.byteVector(), d.struct("Duration", {
  secs: d.u64(),
  nanos: d.u32()
})]))])) }), e6 = d.struct("WriteAccumulatorStorageCost", { storageCost: d.u64() }), t6 = d.enum("EndOfEpochTransactionKind", {
  ChangeEpoch: Gi,
  AuthenticatorStateCreate: null,
  AuthenticatorStateExpire: Hf,
  RandomnessStateCreate: null,
  DenyListStateCreate: null,
  BridgeStateCreate: f0,
  BridgeCommitteeInit: d.u64(),
  StoreExecutionTimeObservations: Kf,
  AccumulatorRootCreate: null,
  CoinRegistryCreate: null,
  DisplayRegistryCreate: null,
  AddressAliasStateCreate: null,
  WriteAccumulatorStorageCost: e6
}), Qi = d.enum("TransactionKind", {
  ProgrammableTransaction: ga,
  ChangeEpoch: Gi,
  Genesis: zf,
  ConsensusCommitPrologue: Gf,
  AuthenticatorStateUpdate: Zf,
  EndOfEpochTransaction: d.vector(t6),
  RandomnessStateUpdate: qf,
  ConsensusCommitPrologueV2: Wf,
  ConsensusCommitPrologueV3: Qf,
  ConsensusCommitPrologueV4: Jf,
  ProgrammableSystemTransaction: ga
}), Ji = d.struct("TransactionDataV1", {
  kind: Qi,
  sender: R,
  gasData: Ci,
  expiration: Ni
}), Yi = d.enum("TransactionData", { V1: Ji }), Zi = d.struct("SenderSignedTransaction", {
  intentMessage: Mi(Yi),
  txSignatures: d.vector(Vf)
}), n6 = d.vector(Zi, { name: "SenderSignedData" }), a6 = d.enum("PackageUpgradeError", {
  UnableToFetchPackage: d.struct("UnableToFetchPackage", { packageId: R }),
  NotAPackage: d.struct("NotAPackage", { objectId: R }),
  IncompatibleUpgrade: null,
  DigestDoesNotMatch: d.struct("DigestDoesNotMatch", { digest: d.byteVector() }),
  UnknownUpgradePolicy: d.struct("UnknownUpgradePolicy", { policy: d.u8() }),
  PackageIDDoesNotMatch: d.struct("PackageIDDoesNotMatch", {
    packageId: R,
    ticketId: R
  })
}), s6 = d.struct("ModuleId", {
  address: R,
  name: d.string()
}), Os = d.struct("MoveLocation", {
  module: s6,
  function: d.u16(),
  instruction: d.u16(),
  functionName: d.option(d.string())
}), r6 = d.enum("CommandArgumentError", {
  TypeMismatch: null,
  InvalidBCSBytes: null,
  InvalidUsageOfPureArg: null,
  InvalidArgumentToPrivateEntryFunction: null,
  IndexOutOfBounds: d.struct("IndexOutOfBounds", { idx: d.u16() }),
  SecondaryIndexOutOfBounds: d.struct("SecondaryIndexOutOfBounds", {
    resultIdx: d.u16(),
    secondaryIdx: d.u16()
  }),
  InvalidResultArity: d.struct("InvalidResultArity", { resultIdx: d.u16() }),
  InvalidGasCoinUsage: null,
  InvalidValueUsage: null,
  InvalidObjectByValue: null,
  InvalidObjectByMutRef: null,
  SharedObjectOperationNotAllowed: null,
  InvalidArgumentArity: null,
  InvalidTransferObject: null,
  InvalidMakeMoveVecNonObjectArgument: null,
  ArgumentWithoutValue: null,
  CannotMoveBorrowedValue: null,
  CannotWriteToExtendedReference: null,
  InvalidReferenceArgument: null
}), i6 = d.enum("TypeArgumentError", {
  TypeNotFound: null,
  ConstraintNotSatisfied: null
}), o6 = d.enum("ExecutionFailureStatus", {
  InsufficientGas: null,
  InvalidGasObject: null,
  InvariantViolation: null,
  FeatureNotYetSupported: null,
  MoveObjectTooBig: d.struct("MoveObjectTooBig", {
    objectSize: d.u64(),
    maxObjectSize: d.u64()
  }),
  MovePackageTooBig: d.struct("MovePackageTooBig", {
    objectSize: d.u64(),
    maxObjectSize: d.u64()
  }),
  CircularObjectOwnership: d.struct("CircularObjectOwnership", { object: R }),
  InsufficientCoinBalance: null,
  CoinBalanceOverflow: null,
  PublishErrorNonZeroAddress: null,
  SuiMoveVerificationError: null,
  MovePrimitiveRuntimeError: d.option(Os),
  MoveAbort: d.tuple([Os, d.u64()]),
  VMVerificationOrDeserializationError: null,
  VMInvariantViolation: null,
  FunctionNotFound: null,
  ArityMismatch: null,
  TypeArityMismatch: null,
  NonEntryFunctionInvoked: null,
  CommandArgumentError: d.struct("CommandArgumentError", {
    argIdx: d.u16(),
    kind: r6
  }),
  TypeArgumentError: d.struct("TypeArgumentError", {
    argumentIdx: d.u16(),
    kind: i6
  }),
  UnusedValueWithoutDrop: d.struct("UnusedValueWithoutDrop", {
    resultIdx: d.u16(),
    secondaryIdx: d.u16()
  }),
  InvalidPublicFunctionReturnType: d.struct("InvalidPublicFunctionReturnType", { idx: d.u16() }),
  InvalidTransferObject: null,
  EffectsTooLarge: d.struct("EffectsTooLarge", {
    currentSize: d.u64(),
    maxSize: d.u64()
  }),
  PublishUpgradeMissingDependency: null,
  PublishUpgradeDependencyDowngrade: null,
  PackageUpgradeError: d.struct("PackageUpgradeError", { upgradeError: a6 }),
  WrittenObjectsTooLarge: d.struct("WrittenObjectsTooLarge", {
    currentSize: d.u64(),
    maxSize: d.u64()
  }),
  CertificateDenied: null,
  SuiMoveVerificationTimedout: null,
  SharedObjectOperationNotAllowed: null,
  InputObjectDeleted: null,
  ExecutionCancelledDueToSharedObjectCongestion: d.struct("ExecutionCancelledDueToSharedObjectCongestion", { congested_objects: d.vector(R) }),
  AddressDeniedForCoin: d.struct("AddressDeniedForCoin", {
    address: R,
    coinType: d.string()
  }),
  CoinTypeGlobalPause: d.struct("CoinTypeGlobalPause", { coinType: d.string() }),
  ExecutionCancelledDueToRandomnessUnavailable: null,
  MoveVectorElemTooBig: d.struct("MoveVectorElemTooBig", {
    valueSize: d.u64(),
    maxScaledSize: d.u64()
  }),
  MoveRawValueTooBig: d.struct("MoveRawValueTooBig", {
    valueSize: d.u64(),
    maxScaledSize: d.u64()
  }),
  InvalidLinkage: null,
  InsufficientBalanceForWithdraw: null,
  NonExclusiveWriteInputObjectModified: d.struct("NonExclusiveWriteInputObjectModified", { id: R })
}), $a = d.enum("ExecutionStatus", {
  Success: null,
  Failure: d.struct("Failure", {
    error: o6,
    command: d.option(d.u64())
  })
}), qi = d.struct("GasCostSummary", {
  computationCost: d.u64(),
  storageCost: d.u64(),
  storageRebate: d.u64(),
  nonRefundableStorageFee: d.u64()
}), c6 = d.struct("TransactionEffectsV1", {
  status: $a,
  executedEpoch: d.u64(),
  gasUsed: qi,
  modifiedAtVersions: d.vector(d.tuple([R, d.u64()])),
  sharedObjects: d.vector(U0),
  transactionDigest: f0,
  created: d.vector(d.tuple([U0, ge])),
  mutated: d.vector(d.tuple([U0, ge])),
  unwrapped: d.vector(d.tuple([U0, ge])),
  deleted: d.vector(U0),
  unwrappedThenDeleted: d.vector(U0),
  wrapped: d.vector(U0),
  gasObject: d.tuple([U0, ge]),
  eventsDigest: d.option(f0),
  dependencies: d.vector(f0)
}), La = d.tuple([d.u64(), f0]), d6 = d.enum("ObjectIn", {
  NotExist: null,
  Exist: d.tuple([La, ge])
}), f6 = d.struct("AccumulatorAddress", {
  address: R,
  ty: Ze
}), u6 = d.enum("AccumulatorOperation", {
  Merge: null,
  Split: null
}), l6 = d.enum("AccumulatorValue", {
  Integer: d.u64(),
  IntegerTuple: d.tuple([d.u64(), d.u64()]),
  EventDigest: d.vector(d.tuple([d.u64(), f0]))
}), b6 = d.struct("AccumulatorWriteV1", {
  address: f6,
  operation: u6,
  value: l6
}), p6 = d.enum("ObjectOut", {
  NotExist: null,
  ObjectWrite: d.tuple([f0, ge]),
  PackageWrite: La,
  AccumulatorWriteV1: b6
}), m6 = d.enum("IDOperation", {
  None: null,
  Created: null,
  Deleted: null
}), g6 = d.struct("EffectsObjectChange", {
  inputState: d6,
  outputState: p6,
  idOperation: m6
}), h6 = d.enum("UnchangedConsensusKind", {
  ReadOnlyRoot: La,
  MutateConsensusStreamEnded: d.u64(),
  ReadConsensusStreamEnded: d.u64(),
  Cancelled: d.u64(),
  PerEpochConfig: null
}), A6 = d.struct("TransactionEffectsV2", {
  status: $a,
  executedEpoch: d.u64(),
  gasUsed: qi,
  transactionDigest: f0,
  gasObjectIndex: d.option(d.u32()),
  eventsDigest: d.option(f0),
  dependencies: d.vector(f0),
  lamportVersion: d.u64(),
  changedObjects: d.vector(d.tuple([R, g6])),
  unchangedConsensusObjects: d.vector(d.tuple([R, h6])),
  auxDataDigest: d.option(f0)
}), y6 = d.enum("TransactionEffects", {
  V1: c6,
  V2: A6
});
function yt(e) {
  switch (e) {
    case "u8":
      return d.u8();
    case "u16":
      return d.u16();
    case "u32":
      return d.u32();
    case "u64":
      return d.u64();
    case "u128":
      return d.u128();
    case "u256":
      return d.u256();
    case "bool":
      return d.bool();
    case "string":
      return d.string();
    case "id":
    case "address":
      return R;
  }
  const t = e.match(/^(vector|option)<(.+)>$/);
  if (t) {
    const [n, a] = t.slice(1);
    return n === "vector" ? d.vector(yt(a)) : d.option(yt(a));
  }
  throw new Error(`Invalid Pure type name: ${e}`);
}
const h = {
  ...d,
  U8: d.u8(),
  U16: d.u16(),
  U32: d.u32(),
  U64: d.u64(),
  U128: d.u128(),
  U256: d.u256(),
  ULEB128: d.uleb128(),
  Bool: d.bool(),
  String: d.string(),
  Address: R,
  AppId: Bi,
  Argument: H0,
  CallArg: Ei,
  Command: ki,
  CompressedSignature: Ri,
  Data: Fa,
  GasData: Ci,
  Intent: ji,
  IntentMessage: Mi,
  IntentScope: xi,
  IntentVersion: _i,
  MoveObject: zi,
  MoveObjectType: Vi,
  MovePackage: Li,
  MultiSig: Pf,
  MultiSigPkMap: Ui,
  MultiSigPublicKey: Pi,
  Object: $f,
  ObjectArg: Oi,
  ObjectDigest: f0,
  Owner: ge,
  PasskeyAuthenticator: Ff,
  ProgrammableMoveCall: Si,
  ProgrammableTransaction: ga,
  PublicKey: Di,
  SenderSignedData: n6,
  SenderSignedTransaction: Zi,
  SharedObjectRef: Ii,
  StructTag: Va,
  SuiObjectRef: U0,
  TransactionData: Yi,
  TransactionDataV1: Ji,
  TransactionEffects: y6,
  TransactionExpiration: Ni,
  TransactionKind: Qi,
  TypeOrigin: Fi,
  TypeTag: Ze,
  UpgradeInfo: $i
}, Es = /* @__PURE__ */ N({
  digest: /* @__PURE__ */ F(),
  objectId: /* @__PURE__ */ F(),
  version: /* @__PURE__ */ F0([
    /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()),
    /* @__PURE__ */ F(),
    /* @__PURE__ */ Da()
  ])
}), w6 = re({
  ImmOrOwned: Es,
  Shared: /* @__PURE__ */ N({
    objectId: M0,
    initialSharedVersion: b0,
    mutable: /* @__PURE__ */ rt()
  }),
  Receiving: Es
}), Ss = re({
  Object: w6,
  Pure: /* @__PURE__ */ P(/* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()))
});
function v6(e) {
  const t = e.inputs.map((n, a) => {
    if (n.Object) return {
      kind: "Input",
      index: a,
      value: { Object: n.Object.ImmOrOwnedObject ? { ImmOrOwned: n.Object.ImmOrOwnedObject } : n.Object.Receiving ? { Receiving: {
        digest: n.Object.Receiving.digest,
        version: n.Object.Receiving.version,
        objectId: n.Object.Receiving.objectId
      } } : { Shared: {
        mutable: n.Object.SharedObject.mutable,
        initialSharedVersion: n.Object.SharedObject.initialSharedVersion,
        objectId: n.Object.SharedObject.objectId
      } } },
      type: "object"
    };
    if (n.Pure) return {
      kind: "Input",
      index: a,
      value: { Pure: Array.from(j0(n.Pure.bytes)) },
      type: "pure"
    };
    if (n.UnresolvedPure) return {
      kind: "Input",
      type: "pure",
      index: a,
      value: n.UnresolvedPure.value
    };
    if (n.UnresolvedObject) return {
      kind: "Input",
      type: "object",
      index: a,
      value: n.UnresolvedObject.objectId
    };
    throw new Error("Invalid input");
  });
  return {
    version: 1,
    sender: e.sender ?? void 0,
    expiration: e.expiration?.$kind === "Epoch" ? { Epoch: Number(e.expiration.Epoch) } : e.expiration ? { None: !0 } : null,
    gasConfig: {
      owner: e.gasData.owner ?? void 0,
      budget: e.gasData.budget ?? void 0,
      price: e.gasData.price ?? void 0,
      payment: e.gasData.payment ?? void 0
    },
    inputs: t,
    transactions: e.commands.map((n) => {
      if (n.MakeMoveVec) return {
        kind: "MakeMoveVec",
        type: n.MakeMoveVec.type === null ? { None: !0 } : { Some: it.parseFromStr(n.MakeMoveVec.type) },
        objects: n.MakeMoveVec.elements.map((a) => oe(a, t))
      };
      if (n.MergeCoins) return {
        kind: "MergeCoins",
        destination: oe(n.MergeCoins.destination, t),
        sources: n.MergeCoins.sources.map((a) => oe(a, t))
      };
      if (n.MoveCall) return {
        kind: "MoveCall",
        target: `${n.MoveCall.package}::${n.MoveCall.module}::${n.MoveCall.function}`,
        typeArguments: n.MoveCall.typeArguments,
        arguments: n.MoveCall.arguments.map((a) => oe(a, t))
      };
      if (n.Publish) return {
        kind: "Publish",
        modules: n.Publish.modules.map((a) => Array.from(j0(a))),
        dependencies: n.Publish.dependencies
      };
      if (n.SplitCoins) return {
        kind: "SplitCoins",
        coin: oe(n.SplitCoins.coin, t),
        amounts: n.SplitCoins.amounts.map((a) => oe(a, t))
      };
      if (n.TransferObjects) return {
        kind: "TransferObjects",
        objects: n.TransferObjects.objects.map((a) => oe(a, t)),
        address: oe(n.TransferObjects.address, t)
      };
      if (n.Upgrade) return {
        kind: "Upgrade",
        modules: n.Upgrade.modules.map((a) => Array.from(j0(a))),
        dependencies: n.Upgrade.dependencies,
        packageId: n.Upgrade.package,
        ticket: oe(n.Upgrade.ticket, t)
      };
      throw new Error(`Unknown transaction ${Object.keys(n)}`);
    })
  };
}
function oe(e, t) {
  if (e.$kind === "GasCoin") return { kind: "GasCoin" };
  if (e.$kind === "Result") return {
    kind: "Result",
    index: e.Result
  };
  if (e.$kind === "NestedResult") return {
    kind: "NestedResult",
    index: e.NestedResult[0],
    resultIndex: e.NestedResult[1]
  };
  if (e.$kind === "Input") return t[e.Input];
  throw new Error(`Invalid argument ${Object.keys(e)}`);
}
function T6(e) {
  return q(Kt, {
    version: 2,
    sender: e.sender ?? null,
    expiration: e.expiration ? "Epoch" in e.expiration ? { Epoch: e.expiration.Epoch } : { None: !0 } : null,
    gasData: {
      owner: e.gasConfig.owner ?? null,
      budget: e.gasConfig.budget?.toString() ?? null,
      price: e.gasConfig.price?.toString() ?? null,
      payment: e.gasConfig.payment?.map((t) => ({
        digest: t.digest,
        objectId: t.objectId,
        version: t.version.toString()
      })) ?? null
    },
    inputs: e.inputs.map((t) => {
      if (t.kind === "Input") {
        if (/* @__PURE__ */ ba(Ss, t.value)) {
          const n = q(Ss, t.value);
          if (n.Object) {
            if (n.Object.ImmOrOwned) return { Object: { ImmOrOwnedObject: {
              objectId: n.Object.ImmOrOwned.objectId,
              version: String(n.Object.ImmOrOwned.version),
              digest: n.Object.ImmOrOwned.digest
            } } };
            if (n.Object.Shared) return { Object: { SharedObject: {
              mutable: n.Object.Shared.mutable ?? null,
              initialSharedVersion: n.Object.Shared.initialSharedVersion,
              objectId: n.Object.Shared.objectId
            } } };
            if (n.Object.Receiving) return { Object: { Receiving: {
              digest: n.Object.Receiving.digest,
              version: String(n.Object.Receiving.version),
              objectId: n.Object.Receiving.objectId
            } } };
            throw new Error("Invalid object input");
          }
          return { Pure: { bytes: I0(new Uint8Array(n.Pure)) } };
        }
        return t.type === "object" ? { UnresolvedObject: { objectId: t.value } } : { UnresolvedPure: { value: t.value } };
      }
      throw new Error("Invalid input");
    }),
    commands: e.transactions.map((t) => {
      switch (t.kind) {
        case "MakeMoveVec":
          return { MakeMoveVec: {
            type: "Some" in t.type ? it.tagToString(t.type.Some) : null,
            elements: t.objects.map((n) => ce(n))
          } };
        case "MergeCoins":
          return { MergeCoins: {
            destination: ce(t.destination),
            sources: t.sources.map((n) => ce(n))
          } };
        case "MoveCall": {
          const [n, a, s] = t.target.split("::");
          return { MoveCall: {
            package: n,
            module: a,
            function: s,
            typeArguments: t.typeArguments,
            arguments: t.arguments.map((r) => ce(r))
          } };
        }
        case "Publish":
          return { Publish: {
            modules: t.modules.map((n) => I0(Uint8Array.from(n))),
            dependencies: t.dependencies
          } };
        case "SplitCoins":
          return { SplitCoins: {
            coin: ce(t.coin),
            amounts: t.amounts.map((n) => ce(n))
          } };
        case "TransferObjects":
          return { TransferObjects: {
            objects: t.objects.map((n) => ce(n)),
            address: ce(t.address)
          } };
        case "Upgrade":
          return { Upgrade: {
            modules: t.modules.map((n) => I0(Uint8Array.from(n))),
            dependencies: t.dependencies,
            package: t.packageId,
            ticket: ce(t.ticket)
          } };
      }
      throw new Error(`Unknown transaction ${Object.keys(t)}`);
    })
  });
}
function ce(e) {
  switch (e.kind) {
    case "GasCoin":
      return { GasCoin: !0 };
    case "Result":
      return { Result: e.index };
    case "NestedResult":
      return { NestedResult: [e.index, e.resultIndex] };
    case "Input":
      return { Input: e.index };
  }
}
function ks(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in e && e.BYTES_PER_ELEMENT === 1;
}
const ha = (e) => e ? `"${e}" ` : "";
function fn(e, t = "") {
  if (typeof e != "number")
    throw new TypeError(ha(t) + "expected number, got " + typeof e);
  if (!Number.isSafeInteger(e) || e < 0)
    throw new RangeError(ha(t) + "expected integer >= 0, got " + e);
  return e;
}
function _e(e, t, n = "") {
  if (ks(e) && (t === void 0 || e.length === t))
    return e;
  t !== void 0 && fn(t, "length");
  const a = ks(e), s = t !== void 0 ? ` of length ${t}` : "", r = a ? `length=${e.length}` : `type=${typeof e}`, i = ha(n) + "expected Uint8Array" + s + ", got " + r;
  throw a ? new RangeError(i) : new TypeError(i);
}
function Ns(e) {
  return Uint8Array.from(_e(e));
}
const Cs = (e, t) => {
  if (e === null || typeof e != "object" || Array.isArray(e))
    throw new TypeError((t === "object" ? "" : `"${t}" `) + "expected object, got type=" + typeof e);
};
function xs(e, t = !0) {
  if (e.destroyed)
    throw new Error("hash was destroyed");
  if (t && e.finished)
    throw new Error("digest() was already called");
}
function I6(e, t) {
  _e(e, void 0, "output");
  const n = t.outputLen;
  if (!(e.length >= n))
    throw new RangeError('"output" expected length >= ' + n);
}
function un(e) {
  return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function Qn(...e) {
  for (let t = 0; t < e.length; t++)
    e[t].fill(0);
}
const Hi = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function Xi(e) {
  return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
const ue = Hi ? (e) => e : (e) => Xi(e) >>> 0;
function O6(e) {
  for (let t = 0; t < e.length; t++)
    e[t] = Xi(e[t]);
  return e;
}
const Xe = Hi ? (e) => e : O6;
function Ki(e, t, n = "opts") {
  return Cs(e, "defaults"), t !== void 0 && Cs(t, n), Object.assign(e, t);
}
function E6(e, t = {}) {
  if (typeof e != "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof e);
  t = Ki({}, t, "info");
  const n = (s, r) => e(r).update(s).digest(), a = e(void 0);
  return n.outputLen = a.outputLen, n.blockLen = a.blockLen, n.canXOF = a.canXOF, n.create = (s) => e(s), Object.assign(n, t), Object.freeze(n);
}
const S6 = /* @__PURE__ */ Uint8Array.from([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  14,
  10,
  4,
  8,
  9,
  15,
  13,
  6,
  1,
  12,
  0,
  2,
  11,
  7,
  5,
  3,
  11,
  8,
  12,
  0,
  5,
  2,
  15,
  13,
  10,
  14,
  3,
  6,
  7,
  1,
  9,
  4,
  7,
  9,
  3,
  1,
  13,
  12,
  11,
  14,
  2,
  6,
  5,
  10,
  4,
  0,
  15,
  8,
  9,
  0,
  5,
  7,
  2,
  4,
  10,
  15,
  14,
  1,
  11,
  12,
  6,
  8,
  3,
  13,
  2,
  12,
  6,
  10,
  0,
  11,
  8,
  3,
  4,
  13,
  7,
  5,
  15,
  14,
  1,
  9,
  12,
  5,
  1,
  15,
  14,
  13,
  4,
  10,
  0,
  7,
  6,
  3,
  9,
  2,
  8,
  11,
  13,
  11,
  7,
  14,
  12,
  1,
  3,
  9,
  5,
  0,
  15,
  4,
  8,
  6,
  2,
  10,
  6,
  15,
  14,
  9,
  11,
  3,
  0,
  8,
  12,
  2,
  13,
  7,
  1,
  4,
  10,
  5,
  10,
  2,
  8,
  4,
  7,
  6,
  1,
  5,
  15,
  11,
  9,
  14,
  3,
  12,
  13,
  0,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  14,
  10,
  4,
  8,
  9,
  15,
  13,
  6,
  1,
  12,
  0,
  2,
  11,
  7,
  5,
  3,
  // Blake1, unused in others
  11,
  8,
  12,
  0,
  5,
  2,
  15,
  13,
  10,
  14,
  3,
  6,
  7,
  1,
  9,
  4,
  7,
  9,
  3,
  1,
  13,
  12,
  11,
  14,
  2,
  6,
  5,
  10,
  4,
  0,
  15,
  8,
  9,
  0,
  5,
  7,
  2,
  4,
  10,
  15,
  14,
  1,
  11,
  12,
  6,
  8,
  3,
  13,
  2,
  12,
  6,
  10,
  0,
  11,
  8,
  3,
  4,
  13,
  7,
  5,
  15,
  14,
  1,
  9
]), k6 = (e) => e / 2 ** 32 | 0, N6 = (e) => e >>> 0, eo = (e, t, n) => e >>> n | t << 32 - n, to = (e, t, n) => e << 32 - n | t >>> n, C6 = (e, t, n) => e << 64 - n | t >>> n - 32, x6 = (e, t, n) => e >>> n - 32 | t << 64 - n, _6 = (e, t) => t, B6 = (e, t) => e;
function no(e, t, n, a) {
  const s = (t >>> 0) + (a >>> 0);
  return { h: e + n + (s / 2 ** 32 | 0) | 0, l: s | 0 };
}
const ao = (e, t, n) => (e >>> 0) + (t >>> 0) + (n >>> 0), so = (e, t, n, a) => t + n + a + (e / 2 ** 32 | 0) | 0, l0 = /* @__PURE__ */ Uint32Array.from([
  4089235720,
  1779033703,
  2227873595,
  3144134277,
  4271175723,
  1013904242,
  1595750129,
  2773480762,
  2917565137,
  1359893119,
  725511199,
  2600822924,
  4215389547,
  528734635,
  327033209,
  1541459225
]), v = /* @__PURE__ */ new Uint32Array(32);
function Ie(e, t, n, a, s, r) {
  const i = s[r], o = s[r + 1];
  let c = v[2 * e], u = v[2 * e + 1], f = v[2 * t], l = v[2 * t + 1], b = v[2 * n], g = v[2 * n + 1], m = v[2 * a], p = v[2 * a + 1];
  const y = ao(c, f, i);
  u = so(y, u, l, o), c = y | 0;
  let E = p ^ u, w = m ^ c;
  p = _6(E, w), m = B6(E), { h: g, l: b } = no(g, b, p, m), E = l ^ g, w = f ^ b, l = eo(E, w, 24), f = to(E, w, 24), v[2 * e] = c, v[2 * e + 1] = u, v[2 * t] = f, v[2 * t + 1] = l, v[2 * n] = b, v[2 * n + 1] = g, v[2 * a] = m, v[2 * a + 1] = p;
}
function Oe(e, t, n, a, s, r) {
  const i = s[r], o = s[r + 1];
  let c = v[2 * e], u = v[2 * e + 1], f = v[2 * t], l = v[2 * t + 1], b = v[2 * n], g = v[2 * n + 1], m = v[2 * a], p = v[2 * a + 1];
  const y = ao(c, f, i);
  u = so(y, u, l, o), c = y | 0;
  let E = p ^ u, w = m ^ c;
  p = eo(E, w, 16), m = to(E, w, 16), { h: g, l: b } = no(g, b, p, m), E = l ^ g, w = f ^ b, l = C6(E, w, 63), f = x6(E, w, 63), v[2 * e] = c, v[2 * e + 1] = u, v[2 * t] = f, v[2 * t + 1] = l, v[2 * n] = b, v[2 * n + 1] = g, v[2 * a] = m, v[2 * a + 1] = p;
}
function j6(e, t = {}, n, a, s) {
  if (fn(n), e <= 0 || e > n)
    throw new Error('"dkLen" must be 1..' + n + ", got " + e);
  const { key: r, salt: i, personalization: o } = t;
  if (r !== void 0 && (r.length < 1 || r.length > n))
    throw new Error('"key" expected to be undefined or of length=1..' + n);
  i !== void 0 && _e(i, a, "salt"), o !== void 0 && _e(o, s, "personalization");
}
class M6 {
  buffer;
  buffer32;
  finished = !1;
  destroyed = !1;
  length = 0;
  pos = 0;
  blockLen;
  outputLen;
  canXOF = !1;
  constructor(t, n) {
    fn(t), fn(n), this.blockLen = t, this.outputLen = n, this.buffer = new Uint8Array(t), this.buffer32 = un(this.buffer);
  }
  update(t) {
    xs(this), _e(t);
    const { blockLen: n, buffer: a, buffer32: s } = this, r = t.length, i = t.byteOffset, o = t.buffer;
    for (let c = 0; c < r; ) {
      this.pos === n && (Xe(s), this.compress(s, 0, !1), Xe(s), this.pos = 0);
      const u = Math.min(n - this.pos, r - c), f = i + c;
      if (u === n && !(f % 4) && c + u < r) {
        const l = new Uint32Array(o, f, Math.floor((r - c) / 4));
        Xe(l);
        for (let b = 0; c + n < r; b += s.length, c += n)
          this.length += n, this.compress(l, b, !1);
        Xe(l);
        continue;
      }
      a.set(c === 0 && u === r ? t : t.subarray(c, c + u), this.pos), this.pos += u, this.length += u, c += u;
    }
    return this;
  }
  digestInto(t) {
    if (xs(this), I6(t, this), t.byteOffset & 3)
      throw new RangeError('"output" expected 4-byte aligned byteOffset, got ' + t.byteOffset);
    const { pos: n, buffer32: a } = this;
    this.finished = !0, this.buffer.fill(0, n), Xe(a), this.compress(a, 0, !0), Xe(a);
    const s = this.get(), r = t === this.buffer ? a : un(t), i = Math.floor(this.outputLen / 4);
    for (let f = 0; f < i; f++)
      r[f] = ue(s[f]);
    const o = this.outputLen % 4;
    if (!o)
      return;
    const c = i * 4, u = s[i];
    for (let f = 0; f < o; f++)
      t[c + f] = u >>> 8 * f;
  }
  digest() {
    const { buffer: t, outputLen: n } = this;
    this.digestInto(t);
    const a = t.slice(0, n);
    return this.destroy(), a;
  }
  _cloneInto(t) {
    const { buffer: n, length: a, finished: s, destroyed: r, outputLen: i, pos: o } = this;
    return t ||= new this.constructor({ dkLen: i }), t.set(...this.get()), t.buffer.set(n), t.destroyed = r, t.finished = s, t.length = a, t.pos = o, t.outputLen = i, t;
  }
  clone() {
    return this._cloneInto();
  }
}
class R6 extends M6 {
  // Same IV words as SHA-512 / BLAKE2b, encoded as LE u32 low/high halves.
  v0l = l0[0] | 0;
  v0h = l0[1] | 0;
  v1l = l0[2] | 0;
  v1h = l0[3] | 0;
  v2l = l0[4] | 0;
  v2h = l0[5] | 0;
  v3l = l0[6] | 0;
  v3h = l0[7] | 0;
  v4l = l0[8] | 0;
  v4h = l0[9] | 0;
  v5l = l0[10] | 0;
  v5h = l0[11] | 0;
  v6l = l0[12] | 0;
  v6h = l0[13] | 0;
  v7l = l0[14] | 0;
  v7h = l0[15] | 0;
  constructor(t = {}) {
    t = Ki({}, t);
    const n = t.dkLen === void 0 ? 64 : t.dkLen;
    super(128, n), j6(n, t, 64, 16, 16);
    let { key: a, personalization: s, salt: r } = t, i = 0;
    if (a !== void 0 && (_e(a, void 0, "key"), i = a.length), this.v0l ^= this.outputLen | i << 8 | 65536 | 1 << 24, r !== void 0) {
      _e(r, void 0, "salt");
      const o = un(Ns(r));
      this.v4l ^= ue(o[0]), this.v4h ^= ue(o[1]), this.v5l ^= ue(o[2]), this.v5h ^= ue(o[3]);
    }
    if (s !== void 0) {
      _e(s, void 0, "personalization");
      const o = un(Ns(s));
      this.v6l ^= ue(o[0]), this.v6h ^= ue(o[1]), this.v7l ^= ue(o[2]), this.v7h ^= ue(o[3]);
    }
    if (a !== void 0) {
      const o = new Uint8Array(this.blockLen);
      o.set(a), this.update(o), Qn(o);
    }
  }
  // prettier-ignore
  get() {
    let { v0l: t, v0h: n, v1l: a, v1h: s, v2l: r, v2h: i, v3l: o, v3h: c, v4l: u, v4h: f, v5l: l, v5h: b, v6l: g, v6h: m, v7l: p, v7h: y } = this;
    return [t, n, a, s, r, i, o, c, u, f, l, b, g, m, p, y];
  }
  // prettier-ignore
  set(t, n, a, s, r, i, o, c, u, f, l, b, g, m, p, y) {
    this.v0l = t | 0, this.v0h = n | 0, this.v1l = a | 0, this.v1h = s | 0, this.v2l = r | 0, this.v2h = i | 0, this.v3l = o | 0, this.v3h = c | 0, this.v4l = u | 0, this.v4h = f | 0, this.v5l = l | 0, this.v5h = b | 0, this.v6l = g | 0, this.v6h = m | 0, this.v7l = p | 0, this.v7h = y | 0;
  }
  compress(t, n, a) {
    const { v0l: s, v0h: r, v1l: i, v1h: o, v2l: c, v2h: u, v3l: f, v3h: l, v4l: b, v4h: g, v5l: m, v5h: p, v6l: y, v6h: E, v7l: w, v7h: W } = this;
    v[0] = s, v[1] = r, v[2] = i, v[3] = o, v[4] = c, v[5] = u, v[6] = f, v[7] = l, v[8] = b, v[9] = g, v[10] = m, v[11] = p, v[12] = y, v[13] = E, v[14] = w, v[15] = W, v.set(l0, 16);
    const L = N6(this.length), L0 = k6(this.length);
    v[24] = l0[8] ^ L, v[25] = l0[9] ^ L0, a && (v[28] = ~v[28], v[29] = ~v[29]);
    let a0 = 0;
    const K = S6;
    for (let Ue = 0; Ue < 12; Ue++)
      Ie(0, 4, 8, 12, t, n + 2 * K[a0++]), Oe(0, 4, 8, 12, t, n + 2 * K[a0++]), Ie(1, 5, 9, 13, t, n + 2 * K[a0++]), Oe(1, 5, 9, 13, t, n + 2 * K[a0++]), Ie(2, 6, 10, 14, t, n + 2 * K[a0++]), Oe(2, 6, 10, 14, t, n + 2 * K[a0++]), Ie(3, 7, 11, 15, t, n + 2 * K[a0++]), Oe(3, 7, 11, 15, t, n + 2 * K[a0++]), Ie(0, 5, 10, 15, t, n + 2 * K[a0++]), Oe(0, 5, 10, 15, t, n + 2 * K[a0++]), Ie(1, 6, 11, 12, t, n + 2 * K[a0++]), Oe(1, 6, 11, 12, t, n + 2 * K[a0++]), Ie(2, 7, 8, 13, t, n + 2 * K[a0++]), Oe(2, 7, 8, 13, t, n + 2 * K[a0++]), Ie(3, 4, 9, 14, t, n + 2 * K[a0++]), Oe(3, 4, 9, 14, t, n + 2 * K[a0++]);
    this.v0l ^= v[0] ^ v[16], this.v0h ^= v[1] ^ v[17], this.v1l ^= v[2] ^ v[18], this.v1h ^= v[3] ^ v[19], this.v2l ^= v[4] ^ v[20], this.v2h ^= v[5] ^ v[21], this.v3l ^= v[6] ^ v[22], this.v3h ^= v[7] ^ v[23], this.v4l ^= v[8] ^ v[24], this.v4h ^= v[9] ^ v[25], this.v5l ^= v[10] ^ v[26], this.v5h ^= v[11] ^ v[27], this.v6l ^= v[12] ^ v[28], this.v6h ^= v[13] ^ v[29], this.v7l ^= v[14] ^ v[30], this.v7h ^= v[15] ^ v[31], Qn(v);
  }
  destroy() {
    this.destroyed = !0, Qn(this.buffer32), this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}
const ro = /* @__PURE__ */ E6((e) => new R6(e));
function D6(e, t) {
  const n = Array.from(`${e}::`).map((s) => s.charCodeAt(0)), a = new Uint8Array(n.length + t.length);
  return a.set(n), a.set(t, n.length), ro(a, { dkLen: 32 });
}
function _s(e) {
  return j(e).replace("0x", "");
}
var tt = class Fe {
  static fromKindBytes(t) {
    const n = h.TransactionKind.parse(t).ProgrammableTransaction;
    if (!n) throw new Error("Unable to deserialize from bytes.");
    return Fe.restore({
      version: 2,
      sender: null,
      expiration: null,
      gasData: {
        budget: null,
        owner: null,
        payment: null,
        price: null
      },
      inputs: n.inputs,
      commands: n.commands
    });
  }
  static fromBytes(t) {
    const n = h.TransactionData.parse(t)?.V1, a = n.kind.ProgrammableTransaction;
    if (!n || !a) throw new Error("Unable to deserialize from bytes.");
    return Fe.restore({
      version: 2,
      sender: n.sender,
      expiration: n.expiration,
      gasData: n.gasData,
      inputs: a.inputs,
      commands: a.commands
    });
  }
  static restore(t) {
    return t.version === 2 ? new Fe(q(Kt, t)) : new Fe(q(Kt, T6(t)));
  }
  /**
  * Generate transaction digest.
  *
  * @param bytes BCS serialized transaction data
  * @returns transaction digest.
  */
  static getDigestFromBytes(t) {
    return Ut(D6("TransactionData", t));
  }
  constructor(t) {
    this.version = 2, this.sender = t?.sender ?? null, this.expiration = t?.expiration ?? null, this.inputs = t?.inputs ?? [], this.commands = t?.commands ?? [], this.gasData = t?.gasData ?? {
      budget: null,
      price: null,
      owner: null,
      payment: null
    };
  }
  build({ maxSizeBytes: t = 1 / 0, overrides: n, onlyTransactionKind: a } = {}) {
    const s = this.inputs, r = this.commands, i = { ProgrammableTransaction: {
      inputs: s,
      commands: r
    } };
    if (a) return h.TransactionKind.serialize(i, { maxSize: t }).toBytes();
    const o = n?.expiration ?? this.expiration, c = n?.sender ?? this.sender, u = {
      ...this.gasData,
      ...n?.gasData
    };
    if (!c) throw new Error("Missing transaction sender");
    if (!u.budget) throw new Error("Missing gas budget");
    if (!u.payment) throw new Error("Missing gas payment");
    if (!u.price) throw new Error("Missing gas price");
    const f = {
      sender: _s(c),
      expiration: o || { None: !0 },
      gasData: {
        payment: u.payment,
        owner: _s(this.gasData.owner ?? c),
        price: BigInt(u.price),
        budget: BigInt(u.budget)
      },
      kind: { ProgrammableTransaction: {
        inputs: s,
        commands: r
      } }
    };
    return h.TransactionData.serialize({ V1: f }, { maxSize: t }).toBytes();
  }
  addInput(t, n) {
    const a = this.inputs.length;
    return this.inputs.push(n), {
      Input: a,
      type: t,
      $kind: "Input"
    };
  }
  getInputUses(t, n) {
    this.mapArguments((a, s) => (a.$kind === "Input" && a.Input === t && n(a, s), a));
  }
  mapCommandArguments(t, n) {
    const a = this.commands[t];
    switch (a.$kind) {
      case "MoveCall":
        a.MoveCall.arguments = a.MoveCall.arguments.map((r) => n(r, a, t));
        break;
      case "TransferObjects":
        a.TransferObjects.objects = a.TransferObjects.objects.map((r) => n(r, a, t)), a.TransferObjects.address = n(a.TransferObjects.address, a, t);
        break;
      case "SplitCoins":
        a.SplitCoins.coin = n(a.SplitCoins.coin, a, t), a.SplitCoins.amounts = a.SplitCoins.amounts.map((r) => n(r, a, t));
        break;
      case "MergeCoins":
        a.MergeCoins.destination = n(a.MergeCoins.destination, a, t), a.MergeCoins.sources = a.MergeCoins.sources.map((r) => n(r, a, t));
        break;
      case "MakeMoveVec":
        a.MakeMoveVec.elements = a.MakeMoveVec.elements.map((r) => n(r, a, t));
        break;
      case "Upgrade":
        a.Upgrade.ticket = n(a.Upgrade.ticket, a, t);
        break;
      case "$Intent":
        const s = a.$Intent.inputs;
        a.$Intent.inputs = {};
        for (const [r, i] of Object.entries(s)) a.$Intent.inputs[r] = Array.isArray(i) ? i.map((o) => n(o, a, t)) : n(i, a, t);
        break;
      case "Publish":
        break;
      default:
        throw new Error(`Unexpected transaction kind: ${a.$kind}`);
    }
  }
  mapArguments(t) {
    for (const n of this.commands.keys()) this.mapCommandArguments(n, t);
  }
  replaceCommand(t, n, a = t) {
    if (!Array.isArray(n)) {
      this.commands[t] = n;
      return;
    }
    const s = n.length - 1;
    this.commands.splice(t, 1, ...structuredClone(n)), this.mapArguments((r, i, o) => {
      if (o < t + n.length) return r;
      if (typeof a != "number" && (r.$kind === "Result" && r.Result === t || r.$kind === "NestedResult" && r.NestedResult[0] === t)) {
        if (!("NestedResult" in r) || r.NestedResult[1] === 0) return q(H, structuredClone(a));
        throw new Error(`Cannot replace command ${t} with a specific result type: NestedResult[${t}, ${r.NestedResult[1]}] references a nested element that cannot be mapped to the replacement result`);
      }
      switch (r.$kind) {
        case "Result":
          r.Result === t && typeof a == "number" && (r.Result = a), r.Result > t && (r.Result += s);
          break;
        case "NestedResult":
          if (r.NestedResult[0] === t && typeof a == "number") return {
            $kind: "NestedResult",
            NestedResult: [a, r.NestedResult[1]]
          };
          r.NestedResult[0] > t && (r.NestedResult[0] += s);
          break;
      }
      return r;
    });
  }
  replaceCommandWithTransaction(t, n, a) {
    if (a.$kind !== "Result" && a.$kind !== "NestedResult") throw new Error("Result must be of kind Result or NestedResult");
    this.insertTransaction(t, n), this.replaceCommand(t + n.commands.length, [], "Result" in a ? { NestedResult: [a.Result + t, 0] } : { NestedResult: [a.NestedResult[0] + t, a.NestedResult[1]] });
  }
  insertTransaction(t, n) {
    const a = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
    for (let o = 0; o < n.inputs.length; o++) {
      const c = n.inputs[o], u = dn(c);
      let f = -1;
      if (u !== void 0 && (f = this.inputs.findIndex((l) => dn(l) === u), f !== -1 && this.inputs[f].Object?.SharedObject && c.Object?.SharedObject && (this.inputs[f].Object.SharedObject.mutable = this.inputs[f].Object.SharedObject.mutable || c.Object.SharedObject.mutable)), f !== -1) a.set(o, f);
      else {
        const l = this.inputs.length;
        this.inputs.push(c), a.set(o, l);
      }
    }
    for (let o = 0; o < n.commands.length; o++) s.set(o, t + o);
    const r = [];
    for (let o = 0; o < n.commands.length; o++) {
      const c = structuredClone(n.commands[o]);
      Nf(c, a, s), r.push(c);
    }
    this.commands.splice(t, 0, ...r);
    const i = r.length;
    i > 0 && this.mapArguments((o, c, u) => {
      if (u >= t && u < t + r.length) return o;
      switch (o.$kind) {
        case "Result":
          o.Result >= t && (o.Result += i);
          break;
        case "NestedResult":
          o.NestedResult[0] >= t && (o.NestedResult[0] += i);
          break;
      }
      return o;
    });
  }
  getDigest() {
    const t = this.build({ onlyTransactionKind: !1 });
    return Fe.getDigestFromBytes(t);
  }
  snapshot() {
    return q(Kt, this);
  }
  shallowClone() {
    return new Fe({
      version: this.version,
      sender: this.sender,
      expiration: this.expiration,
      gasData: { ...this.gasData },
      inputs: [...this.inputs],
      commands: [...this.commands]
    });
  }
  applyResolvedData(t) {
    this.sender || (this.sender = t.sender ?? null), this.expiration || (this.expiration = t.expiration ?? null), this.gasData.budget || (this.gasData.budget = t.gasData.budget), this.gasData.owner || (this.gasData.owner = t.gasData.owner ?? null), this.gasData.payment || (this.gasData.payment = t.gasData.payment), this.gasData.price || (this.gasData.price = t.gasData.price);
    for (let n = 0; n < this.inputs.length; n++) {
      const a = this.inputs[n], s = t.inputs[n];
      switch (a.$kind) {
        case "UnresolvedPure":
          if (s.$kind !== "Pure") throw new Error(`Expected input at index ${n} to resolve to a Pure argument, but got ${JSON.stringify(s)}`);
          this.inputs[n] = s;
          break;
        case "UnresolvedObject":
          if (s.$kind !== "Object") throw new Error(`Expected input at index ${n} to resolve to an Object argument, but got ${JSON.stringify(s)}`);
          if (s.Object.$kind === "ImmOrOwnedObject" || s.Object.$kind === "Receiving") {
            const r = a.UnresolvedObject, i = s.Object.ImmOrOwnedObject ?? s.Object.Receiving;
            if (j(r.objectId) !== j(i.objectId) || r.version != null && r.version !== i.version || r.digest != null && r.digest !== i.digest || r.mutable != null || r.initialSharedVersion != null) throw new Error(`Input at index ${n} did not match unresolved object. ${JSON.stringify(r)} is not compatible with ${JSON.stringify(i)}`);
          } else if (s.Object.$kind === "SharedObject") {
            const r = a.UnresolvedObject, i = s.Object.SharedObject;
            if (j(r.objectId) !== j(i.objectId) || r.initialSharedVersion != null && r.initialSharedVersion !== i.initialSharedVersion || r.mutable != null && r.mutable !== i.mutable || r.version != null || r.digest != null) throw new Error(`Input at index ${n} did not match unresolved object. ${JSON.stringify(r)} is not compatible with ${JSON.stringify(i)}`);
          } else throw new Error(`Input at index ${n} resolved to an unexpected Object kind: ${JSON.stringify(s.Object)}`);
          this.inputs[n] = s;
          break;
      }
    }
  }
};
const p0 = {
  MoveCall(e) {
    const [t, n = "", a = ""] = "target" in e ? e.target.split("::") : [
      e.package,
      e.module,
      e.function
    ];
    return {
      $kind: "MoveCall",
      MoveCall: {
        package: t,
        module: n,
        function: a,
        typeArguments: e.typeArguments ?? [],
        arguments: e.arguments ?? []
      }
    };
  },
  TransferObjects(e, t) {
    return {
      $kind: "TransferObjects",
      TransferObjects: {
        objects: e.map((n) => q(H, n)),
        address: q(H, t)
      }
    };
  },
  SplitCoins(e, t) {
    return {
      $kind: "SplitCoins",
      SplitCoins: {
        coin: q(H, e),
        amounts: t.map((n) => q(H, n))
      }
    };
  },
  MergeCoins(e, t) {
    return {
      $kind: "MergeCoins",
      MergeCoins: {
        destination: q(H, e),
        sources: t.map((n) => q(H, n))
      }
    };
  },
  Publish({ modules: e, dependencies: t }) {
    return {
      $kind: "Publish",
      Publish: {
        modules: e.map((n) => typeof n == "string" ? n : I0(new Uint8Array(n))),
        dependencies: t.map((n) => la(n))
      }
    };
  },
  Upgrade({ modules: e, dependencies: t, package: n, ticket: a }) {
    return {
      $kind: "Upgrade",
      Upgrade: {
        modules: e.map((s) => typeof s == "string" ? s : I0(new Uint8Array(s))),
        dependencies: t.map((s) => la(s)),
        package: n,
        ticket: q(H, a)
      }
    };
  },
  MakeMoveVec({ type: e, elements: t }) {
    return {
      $kind: "MakeMoveVec",
      MakeMoveVec: {
        type: e ?? null,
        elements: t.map((n) => q(H, n))
      }
    };
  },
  Intent({ name: e, inputs: t = {}, data: n = {} }) {
    return {
      $kind: "$Intent",
      $Intent: {
        name: e,
        inputs: Object.fromEntries(Object.entries(t).map(([a, s]) => [a, Array.isArray(s) ? s.map((r) => q(H, r)) : q(H, s)])),
        data: n
      }
    };
  }
};
function U6(e) {
  return {
    $kind: "Pure",
    Pure: { bytes: e instanceof Uint8Array ? I0(e) : e.toBase64() }
  };
}
const g0 = {
  Pure: U6,
  ObjectRef({ objectId: e, digest: t, version: n }) {
    return {
      $kind: "Object",
      Object: {
        $kind: "ImmOrOwnedObject",
        ImmOrOwnedObject: {
          digest: t,
          version: n,
          objectId: j(e)
        }
      }
    };
  },
  SharedObjectRef({ objectId: e, mutable: t, initialSharedVersion: n }) {
    return {
      $kind: "Object",
      Object: {
        $kind: "SharedObject",
        SharedObject: {
          mutable: t,
          initialSharedVersion: n,
          objectId: j(e)
        }
      }
    };
  },
  ReceivingRef({ objectId: e, digest: t, version: n }) {
    return {
      $kind: "Object",
      Object: {
        $kind: "Receiving",
        Receiving: {
          digest: t,
          version: n,
          objectId: j(e)
        }
      }
    };
  },
  FundsWithdrawal({ reservation: e, typeArg: t, withdrawFrom: n }) {
    return {
      $kind: "FundsWithdrawal",
      FundsWithdrawal: {
        reservation: e,
        typeArg: t,
        withdrawFrom: n
      }
    };
  }
};
BigInt(1e9);
const io = "0x0000000000000000000000000000000000000000000000000000000000000001", za = "0x0000000000000000000000000000000000000000000000000000000000000002", P6 = "0x0000000000000000000000000000000000000000000000000000000000000006", ln = `${za}::sui::SUI`, Bs = "0x0000000000000000000000000000000000000000000000000000000000000005", V6 = "0x0000000000000000000000000000000000000000000000000000000000000008", F6 = "0x0000000000000000000000000000000000000000000000000000000000000403";
function oo(e) {
  const t = e.split("::");
  if (t.length !== 3) throw new Error(`Invalid type name format: ${e}`);
  return {
    package: t[0],
    module: t[1],
    name: t[2]
  };
}
function $6(e) {
  if (e.body.$kind !== "datatype") return !1;
  const { package: t, module: n, name: a } = oo(e.body.datatype.typeName);
  return j(t) === za && n === "tx_context" && a === "TxContext";
}
function Aa(e) {
  switch (e.$kind) {
    case "address":
      return h.Address;
    case "bool":
      return h.Bool;
    case "u8":
      return h.U8;
    case "u16":
      return h.U16;
    case "u32":
      return h.U32;
    case "u64":
      return h.U64;
    case "u128":
      return h.U128;
    case "u256":
      return h.U256;
    case "vector": {
      if (e.vector.$kind === "u8") return h.byteVector().transform({
        input: (n) => typeof n == "string" ? new TextEncoder().encode(n) : n,
        output: (n) => n
      });
      const t = Aa(e.vector);
      return t ? h.vector(t) : null;
    }
    case "datatype": {
      const { package: t, module: n, name: a } = oo(e.datatype.typeName), s = j(t);
      if (s === io) {
        if (n === "ascii" && a === "String" || n === "string" && a === "String") return h.String;
        if (n === "option" && a === "Option") {
          const r = Aa(e.datatype.typeParameters[0]);
          return r ? h.vector(r) : null;
        }
      }
      return s === za && n === "object" && a === "ID" ? h.Address : null;
    }
    case "typeParameter":
    case "unknown":
      return null;
  }
}
const Ye = "CoinWithBalance", Ce = Z0("0x2::sui::SUI");
function L6({ type: e = Ce, balance: t, useGasCoin: n = !0 }) {
  let a = null;
  return (s) => {
    if (a) return a;
    s.addIntentResolver(Ye, Ga);
    const r = e === "gas" ? e : Z0(e);
    return a = s.add(p0.Intent({
      name: Ye,
      inputs: {},
      data: {
        type: r === Ce && n ? "gas" : r,
        balance: BigInt(t),
        outputKind: "coin"
      }
    })), a;
  };
}
function z6({ type: e = Ce, balance: t, useGasCoin: n = !0 }) {
  let a = null;
  return (s) => {
    if (a) return a;
    s.addIntentResolver(Ye, Ga);
    const r = e === "gas" ? e : Z0(e);
    return a = s.add(p0.Intent({
      name: Ye,
      inputs: {},
      data: {
        type: r === Ce && n ? "gas" : r,
        balance: BigInt(t),
        outputKind: "balance"
      }
    })), a;
  };
}
const js = /* @__PURE__ */ N({
  type: /* @__PURE__ */ F(),
  balance: /* @__PURE__ */ m0(/* @__PURE__ */ F0([
    /* @__PURE__ */ Da(),
    /* @__PURE__ */ F(),
    /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0())
  ]), /* @__PURE__ */ Cn((e) => BigInt(e))),
  outputKind: /* @__PURE__ */ k0(/* @__PURE__ */ Ai(["coin", "balance"]))
});
async function Ga(e, t, n) {
  const a = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
  if (!e.sender) throw new Error("Sender must be set to resolve CoinWithBalance");
  for (const [m, p] of e.commands.entries()) {
    if (p.$kind !== "$Intent" || p.$Intent.name !== Ye) continue;
    const { type: y, balance: E, outputKind: w } = q(js, p.$Intent.data);
    if (E === 0n) {
      const W = y === "gas" ? Ce : y;
      e.replaceCommand(m, p0.MoveCall({
        target: (w ?? "coin") === "balance" ? "0x2::balance::zero" : "0x2::coin::zero",
        typeArguments: [W]
      }));
      continue;
    }
    y !== "gas" && a.add(y), s.set(y, (s.get(y) ?? 0n) + E), r.has(y) || r.set(y, []), r.get(y).push({
      balance: E,
      outputKind: w ?? "coin"
    });
  }
  if (s.has("gas") && s.has(Ce)) throw new Error("Cannot mix SUI CoinWithBalance intents that use the gas coin with ones that do not (useGasCoin: false). Use one or the other.");
  const i = /* @__PURE__ */ new Set();
  for (const m of e.inputs)
    m.Object?.ImmOrOwnedObject && i.add(m.Object.ImmOrOwnedObject.objectId), m.UnresolvedObject?.objectId && i.add(m.UnresolvedObject.objectId);
  const o = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), u = t.client;
  if (!u) throw new Error("Client must be provided to build or serialize transactions with CoinWithBalance intents");
  await Promise.all([...[...a].map(async (m) => {
    const { coins: p, addressBalance: y } = await G6({
      coinType: m,
      balance: s.get(m),
      client: u,
      owner: e.sender,
      usedIds: i
    });
    o.set(m, p), c.set(m, y);
  }), s.has("gas") ? await u.core.getBalance({
    owner: e.sender,
    coinType: Ce
  }).then(({ balance: m }) => {
    c.set("gas", BigInt(m.addressBalance));
  }) : null]);
  const f = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), b = /* @__PURE__ */ new Map();
  let g = 0;
  for (; g < e.commands.length; ) {
    const m = e.commands[g];
    if (m.$kind !== "$Intent" || m.$Intent.name !== Ye) {
      g++;
      continue;
    }
    const { type: p, balance: y } = q(js, m.$Intent.data), E = p === "gas" ? Ce : p, w = s.get(p), W = c.get(p) ?? 0n, L = [];
    let L0;
    const a0 = r.get(p) ?? [];
    if (a0.every((K) => K.outputKind === "balance") && W >= w)
      L.push(p0.MoveCall({
        target: "0x2::balance::redeem_funds",
        typeArguments: [E],
        arguments: [e.addInput("withdrawal", g0.FundsWithdrawal({
          reservation: {
            $kind: "MaxAmountU64",
            MaxAmountU64: String(y)
          },
          typeArg: {
            $kind: "Balance",
            Balance: E
          },
          withdrawFrom: {
            $kind: "Sender",
            Sender: !0
          }
        }))]
      })), L0 = {
        $kind: "NestedResult",
        NestedResult: [g + L.length - 1, 0]
      };
    else {
      if (!b.has(p)) {
        const Ue = a0, He = [];
        if (W >= w)
          l.add(p), L.push(p0.MoveCall({
            target: "0x2::coin::redeem_funds",
            typeArguments: [E],
            arguments: [e.addInput("withdrawal", g0.FundsWithdrawal({
              reservation: {
                $kind: "MaxAmountU64",
                MaxAmountU64: String(w)
              },
              typeArg: {
                $kind: "Balance",
                Balance: E
              },
              withdrawFrom: {
                $kind: "Sender",
                Sender: !0
              }
            }))]
          })), He.push({
            $kind: "Result",
            Result: g + L.length - 1
          });
        else if (p === "gas") He.push({
          $kind: "GasCoin",
          GasCoin: !0
        });
        else {
          const A0 = o.get(p), Te = A0.reduce((lt, ac) => lt + BigInt(ac.balance), 0n), ut = w > Te ? w - Te : 0n;
          f.set(p, Te + ut === w);
          for (const lt of A0) He.push(e.addInput("object", g0.ObjectRef({
            objectId: lt.objectId,
            digest: lt.digest,
            version: lt.version
          })));
          ut > 0n && (l.add(p), L.push(p0.MoveCall({
            target: "0x2::coin::redeem_funds",
            typeArguments: [E],
            arguments: [e.addInput("withdrawal", g0.FundsWithdrawal({
              reservation: {
                $kind: "MaxAmountU64",
                MaxAmountU64: String(ut)
              },
              typeArg: {
                $kind: "Balance",
                Balance: E
              },
              withdrawFrom: {
                $kind: "Sender",
                Sender: !0
              }
            }))]
          })), He.push({
            $kind: "Result",
            Result: g + L.length - 1
          }));
        }
        const $t = He[0], as = He.slice(1);
        for (let A0 = 0; A0 < as.length; A0 += 500) L.push(p0.MergeCoins($t, as.slice(A0, A0 + 500)));
        const nc = g + L.length;
        L.push(p0.SplitCoins($t, Ue.map((A0) => e.addInput("pure", g0.Pure(h.u64().serialize(A0.balance))))));
        const Rn = [];
        for (let A0 = 0; A0 < Ue.length; A0++) {
          const Te = {
            $kind: "NestedResult",
            NestedResult: [nc, A0]
          };
          Ue[A0].outputKind === "balance" ? (L.push(p0.MoveCall({
            target: "0x2::coin::into_balance",
            typeArguments: [E],
            arguments: [Te]
          })), Rn.push({
            $kind: "NestedResult",
            NestedResult: [g + L.length - 1, 0]
          })) : Rn.push(Te);
        }
        if (p !== "gas" || l.has(p)) {
          const A0 = Ue.some((ut) => ut.outputKind === "balance"), Te = l.has(p);
          A0 || Te ? L.push(p0.MoveCall({
            target: "0x2::coin::send_funds",
            typeArguments: [E],
            arguments: [$t, e.addInput("pure", g0.Pure(h.Address.serialize(e.sender)))]
          })) : f.get(p) && L.push(p0.MoveCall({
            target: "0x2::coin::destroy_zero",
            typeArguments: [E],
            arguments: [$t]
          }));
        }
        b.set(p, {
          results: Rn,
          nextIntent: 0
        });
      }
      const K = b.get(p);
      L0 = K.results[K.nextIntent++];
    }
    e.replaceCommand(g, L, L0), g += L.length;
  }
  return n();
}
async function G6({ coinType: e, balance: t, client: n, owner: a, usedIds: s }) {
  let r = t;
  const i = [], o = n.core.getBalance({
    owner: a,
    coinType: e
  }).then(({ balance: l }) => (r -= BigInt(l.addressBalance), l)), [c, u] = await Promise.all([f(), o]);
  if (BigInt(u.balance) < t) throw new Error(`Insufficient balance of ${e} for owner ${a}. Required: ${t}, Available: ${t - r}`);
  return {
    coins: c,
    balance: BigInt(u.coinBalance),
    addressBalance: BigInt(u.addressBalance),
    coinBalance: BigInt(u.coinBalance)
  };
  async function f(l = null) {
    const { objects: b, hasNextPage: g, cursor: m } = await n.core.listCoins({
      owner: a,
      coinType: e,
      cursor: l
    });
    await o;
    for (const p of b)
      s.has(p.objectId) || (i.push(p), r -= BigInt(p.balance));
    return r > 0n && g ? f(m) : i;
  }
}
function Bt(e) {
  return /* @__PURE__ */ F0(Object.entries(e).map(([t, n]) => /* @__PURE__ */ N({ [t]: n })));
}
const G0 = Bt({
  GasCoin: /* @__PURE__ */ z(!0),
  Input: /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()),
  Result: /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()),
  NestedResult: /* @__PURE__ */ Ua([/* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0()), /* @__PURE__ */ m0(/* @__PURE__ */ T0(), /* @__PURE__ */ v0())])
}), W6 = /* @__PURE__ */ N({
  budget: /* @__PURE__ */ Y(b0),
  price: /* @__PURE__ */ Y(b0),
  owner: /* @__PURE__ */ Y(ft),
  payment: /* @__PURE__ */ Y(/* @__PURE__ */ P(Me))
}), Q6 = /* @__PURE__ */ N({
  package: M0,
  module: /* @__PURE__ */ F(),
  function: /* @__PURE__ */ F(),
  typeArguments: /* @__PURE__ */ P(/* @__PURE__ */ F()),
  arguments: /* @__PURE__ */ P(G0)
}), J6 = /* @__PURE__ */ N({
  name: /* @__PURE__ */ F(),
  inputs: /* @__PURE__ */ _t(/* @__PURE__ */ F(), /* @__PURE__ */ F0([G0, /* @__PURE__ */ P(G0)])),
  data: /* @__PURE__ */ _t(/* @__PURE__ */ F(), /* @__PURE__ */ Pt())
}), Y6 = Bt({
  MoveCall: Q6,
  TransferObjects: /* @__PURE__ */ N({
    objects: /* @__PURE__ */ P(G0),
    address: G0
  }),
  SplitCoins: /* @__PURE__ */ N({
    coin: G0,
    amounts: /* @__PURE__ */ P(G0)
  }),
  MergeCoins: /* @__PURE__ */ N({
    destination: G0,
    sources: /* @__PURE__ */ P(G0)
  }),
  Publish: /* @__PURE__ */ N({
    modules: /* @__PURE__ */ P(Je),
    dependencies: /* @__PURE__ */ P(M0)
  }),
  MakeMoveVec: /* @__PURE__ */ N({
    type: /* @__PURE__ */ Y(/* @__PURE__ */ F()),
    elements: /* @__PURE__ */ P(G0)
  }),
  Upgrade: /* @__PURE__ */ N({
    modules: /* @__PURE__ */ P(Je),
    dependencies: /* @__PURE__ */ P(M0),
    package: M0,
    ticket: G0
  }),
  $Intent: J6
}), Z6 = Bt({
  Object: Bt({
    ImmOrOwnedObject: Me,
    SharedObject: /* @__PURE__ */ N({
      objectId: M0,
      initialSharedVersion: b0,
      mutable: /* @__PURE__ */ rt()
    }),
    Receiving: Me
  }),
  Pure: /* @__PURE__ */ N({ bytes: Je }),
  UnresolvedPure: /* @__PURE__ */ N({ value: /* @__PURE__ */ Pt() }),
  UnresolvedObject: /* @__PURE__ */ N({
    objectId: M0,
    version: /* @__PURE__ */ k0(/* @__PURE__ */ Y(b0)),
    digest: /* @__PURE__ */ k0(/* @__PURE__ */ Y(/* @__PURE__ */ F())),
    initialSharedVersion: /* @__PURE__ */ k0(/* @__PURE__ */ Y(b0)),
    mutable: /* @__PURE__ */ k0(/* @__PURE__ */ Y(/* @__PURE__ */ rt()))
  }),
  FundsWithdrawal: wi
}), q6 = Bt({
  None: /* @__PURE__ */ z(!0),
  Epoch: b0,
  ValidDuring: vi
}), H6 = /* @__PURE__ */ N({
  version: /* @__PURE__ */ z(2),
  sender: /* @__PURE__ */ xt(ft),
  expiration: /* @__PURE__ */ xt(q6),
  gasData: W6,
  inputs: /* @__PURE__ */ P(Z6),
  commands: /* @__PURE__ */ P(Y6),
  digest: /* @__PURE__ */ k0(/* @__PURE__ */ Y(/* @__PURE__ */ F()))
});
var Wa = class extends Error {
}, co = class extends Wa {
  constructor(e, t) {
    super(e, { cause: t?.cause }), this.executionError = t?.executionError;
  }
}, Ms = class extends Wa {
  constructor(e, t, n) {
    super(t, { cause: n?.cause }), this.code = e, this.reason = n?.reason ?? "unknown", this.objectId = n?.objectId;
  }
};
const X6 = { notFound: (e) => `Transaction ${e} not found` };
var K6 = class extends Wa {
  constructor(e, t, n) {
    super(X6[e](t), n), this.reason = e, this.digest = t;
  }
};
function Vt(e, t, n) {
  const a = h.Address.serialize(e).toBytes(), s = h.TypeTag.serialize(t).toBytes(), r = h.u64().serialize(n.length).toBytes(), i = ro.create({ dkLen: 32 });
  return i.update(new Uint8Array([240])), i.update(a), i.update(r), i.update(n), i.update(s), `0x${Ae(i.digest().slice(0, 32))}`;
}
const e5 = j("0xacc"), t5 = it.parseFromStr("0x2::accumulator::Key<0x2::balance::Balance<0x2::sui::SUI>>"), n5 = new Uint8Array([
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172
]);
function a5(e, t) {
  const n = Ma(Vt(e5, t5, h.Address.serialize(e).toBytes()).slice(2)), a = Nt(t);
  if (a.length !== 32) throw new Error(`Invalid chain identifier length: expected 32 bytes, got ${a.length}`);
  const s = new Uint8Array(32);
  for (let r = 0; r < 32; r++) s[r] = n[r] ^ a[r];
  return `0x${Ae(s)}`;
}
function s5(e, t, n, a) {
  const s = new Uint8Array(32), r = new DataView(s.buffer);
  r.setBigUint64(0, e, !0);
  const i = Number(a);
  if (!Number.isSafeInteger(i) || i < 0 || i > 4294967295) throw new Error(`Epoch ${a} out of u32 range for coin reservation digest`);
  return r.setUint32(8, i, !0), s.set(n5, 12), q(Me, {
    objectId: a5(t, n),
    version: "0",
    digest: Ut(s)
  });
}
function w0(e) {
  return Uint8Array.from(atob(e), (t) => t.charCodeAt(0));
}
const Jn = 8192;
function ya(e) {
  if (e.length < Jn) return btoa(String.fromCharCode(...e));
  let t = "";
  for (var n = 0; n < e.length; n += Jn) {
    const a = e.slice(n, n + Jn);
    t += String.fromCharCode(...a);
  }
  return btoa(t);
}
function bn(e, t) {
  return Array.from({ length: Math.ceil(e.length / t) }, (n, a) => e.slice(a * t, (a + 1) * t));
}
var Rs = class {
  constructor(e, t) {
    if (typeof e != "function") throw new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but got: ${e}.`);
    this._batchLoadFn = e, this._maxBatchSize = c5(t), this._batchScheduleFn = d5(t), this._cacheKeyFn = f5(t), this._cacheMap = u5(t), this._batch = null, this.name = l5(t);
  }
  /**
  * Loads a key, returning a `Promise` for the value represented by that key.
  */
  load(e) {
    if (e == null) throw new TypeError(`The loader.load() function must be called with a value, but got: ${String(e)}.`);
    const t = i5(this), n = this._cacheMap;
    let a;
    if (n) {
      a = this._cacheKeyFn(e);
      const r = n.get(a);
      if (r) {
        const i = t.cacheHits || (t.cacheHits = []);
        return new Promise((o) => {
          i.push(() => {
            o(r);
          });
        });
      }
    }
    t.keys.push(e);
    const s = new Promise((r, i) => {
      t.callbacks.push({
        resolve: r,
        reject: i
      });
    });
    return n && n.set(a, s), s;
  }
  /**
  * Loads multiple keys, promising an array of values:
  *
  *     var [ a, b ] = await myLoader.loadMany([ 'a', 'b' ]);
  *
  * This is similar to the more verbose:
  *
  *     var [ a, b ] = await Promise.all([
  *       myLoader.load('a'),
  *       myLoader.load('b')
  *     ]);
  *
  * However it is different in the case where any load fails. Where
  * Promise.all() would reject, loadMany() always resolves, however each result
  * is either a value or an Error instance.
  *
  *     var [ a, b, c ] = await myLoader.loadMany([ 'a', 'b', 'badkey' ]);
  *     // c instanceof Error
  *
  */
  loadMany(e) {
    if (!fo(e)) throw new TypeError(`The loader.loadMany() function must be called with Array<key>, but got: ${e}.`);
    const t = [];
    for (let n = 0; n < e.length; n++) t.push(this.load(e[n]).catch((a) => a));
    return Promise.all(t);
  }
  /**
  * Clears the value at `key` from the cache, if it exists. Returns itself for
  * method chaining.
  */
  clear(e) {
    const t = this._cacheMap;
    if (t) {
      const n = this._cacheKeyFn(e);
      t.delete(n);
    }
    return this;
  }
  /**
  * Clears the entire cache. To be used when some event results in unknown
  * invalidations across this particular `DataLoader`. Returns itself for
  * method chaining.
  */
  clearAll() {
    const e = this._cacheMap;
    return e && e.clear(), this;
  }
  /**
  * Adds the provided key and value to the cache. If the key already
  * exists, no change is made. Returns itself for method chaining.
  *
  * To prime the cache with an error at a key, provide an Error instance.
  */
  prime(e, t) {
    const n = this._cacheMap;
    if (n) {
      const a = this._cacheKeyFn(e);
      if (n.get(a) === void 0) {
        let s;
        t instanceof Error ? (s = Promise.reject(t), s.catch(() => {
        })) : s = Promise.resolve(t), n.set(a, s);
      }
    }
    return this;
  }
};
const r5 = typeof process == "object" && typeof process.nextTick == "function" ? function(e) {
  Yn || (Yn = Promise.resolve()), Yn.then(() => {
    process.nextTick(e);
  });
} : typeof setImmediate == "function" ? function(e) {
  setImmediate(e);
} : function(e) {
  setTimeout(e);
};
let Yn;
function i5(e) {
  const t = e._batch;
  if (t !== null && !t.hasDispatched && t.keys.length < e._maxBatchSize) return t;
  const n = {
    hasDispatched: !1,
    keys: [],
    callbacks: []
  };
  return e._batch = n, e._batchScheduleFn(() => {
    o5(e, n);
  }), n;
}
function o5(e, t) {
  if (t.hasDispatched = !0, t.keys.length === 0) {
    wa(t);
    return;
  }
  let n;
  try {
    n = e._batchLoadFn(t.keys);
  } catch (a) {
    return Zn(e, t, /* @__PURE__ */ new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function errored synchronously: ${String(a)}.`));
  }
  if (!n || typeof n.then != "function") return Zn(e, t, /* @__PURE__ */ new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise: ${String(n)}.`));
  Promise.resolve(n).then((a) => {
    if (!fo(a)) throw new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise of an Array: ${String(a)}.`);
    if (a.length !== t.keys.length) throw new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise of an Array of the same length as the Array of keys.

Keys:
${String(t.keys)}

Values:
${String(a)}`);
    wa(t);
    for (let s = 0; s < t.callbacks.length; s++) {
      const r = a[s];
      r instanceof Error ? t.callbacks[s].reject(r) : t.callbacks[s].resolve(r);
    }
  }).catch((a) => {
    Zn(e, t, a);
  });
}
function Zn(e, t, n) {
  wa(t);
  for (let a = 0; a < t.keys.length; a++)
    e.clear(t.keys[a]), t.callbacks[a].reject(n);
}
function wa(e) {
  if (e.cacheHits) for (let t = 0; t < e.cacheHits.length; t++) e.cacheHits[t]();
}
function c5(e) {
  if (!(!e || e.batch !== !1)) return 1;
  const t = e && e.maxBatchSize;
  if (t === void 0) return 1 / 0;
  if (typeof t != "number" || t < 1) throw new TypeError(`maxBatchSize must be a positive number: ${t}`);
  return t;
}
function d5(e) {
  const t = e && e.batchScheduleFn;
  if (t === void 0) return r5;
  if (typeof t != "function") throw new TypeError(`batchScheduleFn must be a function: ${t}`);
  return t;
}
function f5(e) {
  const t = e && e.cacheKeyFn;
  if (t === void 0) return (n) => n;
  if (typeof t != "function") throw new TypeError(`cacheKeyFn must be a function: ${t}`);
  return t;
}
function u5(e) {
  if (!(!e || e.cache !== !1)) return null;
  const t = e && e.cacheMap;
  if (t === void 0) return /* @__PURE__ */ new Map();
  if (t !== null) {
    const n = [
      "get",
      "set",
      "delete",
      "clear"
    ].filter((a) => t && typeof t[a] != "function");
    if (n.length !== 0) throw new TypeError("Custom cacheMap missing methods: " + n.join(", "));
  }
  return t;
}
function l5(e) {
  return e && e.name ? e.name : null;
}
function fo(e) {
  return typeof e == "object" && e !== null && "length" in e && typeof e.length == "number" && (e.length === 0 || e.length > 0 && Object.prototype.hasOwnProperty.call(e, e.length - 1));
}
const b5 = 50, p5 = 1000n, m5 = 5e10;
function g5(e, t = 1n) {
  const n = p5 * BigInt(t), a = BigInt(e.computationCost) + n, s = a + BigInt(e.storageCost) - BigInt(e.storageRebate);
  return String(s > a ? s : a);
}
function h5(e) {
  if (!e.client) throw new Error("No sui client passed to Transaction#build, but transaction data was not sufficient to build offline.");
  return e.client;
}
async function A5(e, t, n) {
  const a = h5(t), s = !t.onlyTransactionKind && !e.gasData.price, r = !t.onlyTransactionKind && !e.gasData.payment, i = e.gasData.owner ?? e.sender;
  let o = !1, c = 0n;
  e.mapArguments((E) => (E.$kind === "GasCoin" && (o = !0), E));
  const u = i ? j(i) : null;
  for (const E of e.inputs) {
    if (E.$kind !== "FundsWithdrawal" || !u || Z0(E.FundsWithdrawal.typeArg.Balance) !== ln) continue;
    const w = E.FundsWithdrawal.withdrawFrom.Sender ? e.sender : i;
    w && j(w) === u && E.FundsWithdrawal.reservation.$kind === "MaxAmountU64" && (c += BigInt(E.FundsWithdrawal.reservation.MaxAmountU64));
  }
  const f = !t.onlyTransactionKind && !e.expiration && !e.gasData.budget, l = s || r && o || f, b = r && o || f, [, g, m, p, y] = await Promise.all([
    I5(e, a),
    l ? a.core.getCurrentSystemState() : null,
    r && i ? a.core.getBalance({ owner: i }) : null,
    r && i ? a.core.listCoins({
      owner: i,
      coinType: ln
    }) : null,
    b ? a.core.getChainIdentifier() : null
  ]);
  if (await T5(e, a), !t.onlyTransactionKind) {
    const E = g?.systemState ?? null, w = y?.chainIdentifier ?? null;
    if (E && !e.gasData.price && (e.gasData.price = E.referenceGasPrice), await y5(e, a, f && E && w ? uo(E, w) : void 0), r) {
      if (!m || !p) throw new Error("Could not resolve gas payment: a gas owner or sender must be set to fetch balance and coins.");
      w5({
        transactionData: e,
        balance: m,
        coins: p,
        usesGasCoin: o,
        withdrawals: c,
        gasPayer: i,
        chainIdentifier: w,
        epoch: E?.epoch ?? null
      });
    }
    !e.expiration && e.gasData.payment?.length === 0 && await v5(e, a, E, w);
  }
  return await n();
}
async function y5(e, t, n) {
  if (e.gasData.budget) return;
  const a = await t.core.simulateTransaction({
    transaction: e.build({ overrides: {
      gasData: {
        budget: String(m5),
        payment: []
      },
      ...n && { expiration: n }
    } }),
    include: { effects: !0 },
    doGasSelection: !1
  });
  if (a.$kind === "FailedTransaction") {
    const s = a.FailedTransaction.status.error ?? void 0;
    throw new co(`Transaction resolution failed: ${s?.message ?? "Unknown error"}`, {
      cause: a,
      executionError: s
    });
  }
  e.gasData.budget = g5(a.Transaction.effects.gasUsed, e.gasData.price ? String(e.gasData.price) : void 0);
}
function w5({ transactionData: e, balance: t, coins: n, usesGasCoin: a, withdrawals: s, gasPayer: r, chainIdentifier: i, epoch: o }) {
  const c = BigInt(e.gasData.budget), u = BigInt(t.balance.addressBalance);
  if (c === 0n || !a && u >= c + s) {
    e.gasData.payment = [];
    return;
  }
  const f = n.objects.filter((g) => !e.inputs.find((m) => m.Object?.ImmOrOwnedObject ? g.objectId === m.Object.ImmOrOwnedObject.objectId : !1)), l = f.map((g) => ({
    objectId: g.objectId,
    digest: g.digest,
    version: g.version
  })), b = u - s;
  if (a && b > 0n && i && o) e.gasData.payment = [s5(b, r, i, o), ...l];
  else if (f.length) e.gasData.payment = l;
  else throw new Error("No valid gas coins found for the transaction.");
}
async function v5(e, t, n, a = null) {
  const [s, r] = await Promise.all([a ?? t.core.getChainIdentifier().then((i) => i.chainIdentifier), n ?? t.core.getCurrentSystemState().then((i) => i.systemState)]);
  e.expiration = uo(r, s);
}
function uo(e, t) {
  const n = BigInt(e.epoch);
  return {
    $kind: "ValidDuring",
    ValidDuring: {
      minEpoch: String(n),
      maxEpoch: String(n + 1n),
      minTimestamp: null,
      maxTimestamp: null,
      chain: t,
      nonce: Math.random() * 4294967296 >>> 0
    }
  };
}
async function T5(e, t) {
  const n = e.inputs.filter((f) => f.UnresolvedObject && !(f.UnresolvedObject.version || f.UnresolvedObject?.initialSharedVersion)), a = [...new Set(n.map((f) => la(f.UnresolvedObject.objectId)))], s = a.length ? bn(a, b5) : [], r = (await Promise.all(s.map((f) => t.core.getObjects({ objectIds: f })))).flatMap((f) => f.objects), i = new Map(a.map((f, l) => [f, r[l]])), o = Array.from(i).filter(([f, l]) => l instanceof Error).map(([f, l]) => l.message);
  if (o.length) throw new Error(`The following input objects are invalid: ${o.join(", ")}`);
  const c = r.map((f) => {
    if (f instanceof Error) throw new Error(`Failed to fetch object: ${f.message}`);
    const l = f.owner, b = l && typeof l == "object" ? l.$kind === "Shared" ? l.Shared.initialSharedVersion : l.$kind === "ConsensusAddressOwner" ? l.ConsensusAddressOwner.startVersion : null : null;
    return {
      objectId: f.objectId,
      digest: f.digest,
      version: f.version,
      initialSharedVersion: b
    };
  }), u = new Map(a.map((f, l) => [f, c[l]]));
  for (const [f, l] of e.inputs.entries()) {
    if (!l.UnresolvedObject) continue;
    let b;
    const g = j(l.UnresolvedObject.objectId), m = u.get(g);
    l.UnresolvedObject.initialSharedVersion ?? m?.initialSharedVersion ? b = g0.SharedObjectRef({
      objectId: g,
      initialSharedVersion: l.UnresolvedObject.initialSharedVersion || m?.initialSharedVersion,
      mutable: l.UnresolvedObject.mutable || O5(e, f)
    }) : E5(e, f) && (b = g0.ReceivingRef({
      objectId: g,
      digest: l.UnresolvedObject.digest ?? m?.digest,
      version: l.UnresolvedObject.version ?? m?.version
    })), e.inputs[e.inputs.indexOf(l)] = b ?? g0.ObjectRef({
      objectId: g,
      digest: l.UnresolvedObject.digest ?? m?.digest,
      version: l.UnresolvedObject.version ?? m?.version
    });
  }
}
async function I5(e, t) {
  const { inputs: n, commands: a } = e, s = [], r = /* @__PURE__ */ new Set();
  a.forEach((o) => {
    if (o.MoveCall) {
      if (o.MoveCall._argumentTypes) return;
      if (o.MoveCall.arguments.map((c) => c.$kind === "Input" ? e.inputs[c.Input] : null).some((c) => c?.UnresolvedPure || c?.UnresolvedObject && typeof c?.UnresolvedObject.mutable != "boolean")) {
        const c = `${o.MoveCall.package}::${o.MoveCall.module}::${o.MoveCall.function}`;
        r.add(c), s.push(o.MoveCall);
      }
    }
  });
  const i = /* @__PURE__ */ new Map();
  r.size > 0 && await Promise.all([...r].map(async (o) => {
    const [c, u, f] = o.split("::"), { function: l } = await t.core.getMoveFunction({
      packageId: c,
      moduleName: u,
      name: f
    });
    i.set(o, l.parameters);
  })), s.length && await Promise.all(s.map(async (o) => {
    const c = i.get(`${o.package}::${o.module}::${o.function}`);
    c && (o._argumentTypes = c.length > 0 && $6(c.at(-1)) ? c.slice(0, c.length - 1) : c);
  })), a.forEach((o) => {
    if (!o.MoveCall) return;
    const c = o.MoveCall, u = `${c.package}::${c.module}::${c.function}`, f = c._argumentTypes;
    if (f) {
      if (f.length !== o.MoveCall.arguments.length) throw new Error(`Incorrect number of arguments for ${u}`);
      f.forEach((l, b) => {
        const g = c.arguments[b];
        if (g.$kind !== "Input") return;
        const m = n[g.Input];
        if (!m.UnresolvedPure && !m.UnresolvedObject) return;
        const p = m.UnresolvedPure?.value ?? m.UnresolvedObject?.objectId, y = Aa(l.body);
        if (y) {
          g.type = "pure", n[n.indexOf(m)] = g0.Pure(y.serialize(p));
          return;
        }
        if (typeof p != "string") throw new Error(`Expect the argument to be an object id string, got ${JSON.stringify(p, null, 2)}`);
        g.type = "object";
        const E = m.UnresolvedPure ? {
          $kind: "UnresolvedObject",
          UnresolvedObject: { objectId: p }
        } : m;
        n[g.Input] = E;
      });
    }
  });
}
function O5(e, t) {
  let n = !1;
  return e.getInputUses(t, (a, s) => {
    if (s.MoveCall && s.MoveCall._argumentTypes) {
      const r = s.MoveCall.arguments.indexOf(a);
      n = s.MoveCall._argumentTypes[r].reference !== "immutable" || n;
    }
    (s.$kind === "MakeMoveVec" || s.$kind === "MergeCoins" || s.$kind === "SplitCoins" || s.$kind === "TransferObjects") && (n = !0);
  }), n;
}
function E5(e, t) {
  let n = !1;
  return e.getInputUses(t, (a, s) => {
    if (s.MoveCall && s.MoveCall._argumentTypes) {
      const r = s.MoveCall.arguments.indexOf(a);
      n = k5(s.MoveCall._argumentTypes[r]) || n;
    }
  }), n;
}
const S5 = "0x0000000000000000000000000000000000000000000000000000000000000002::transfer::Receiving";
function k5(e) {
  return e.body.$kind !== "datatype" ? !1 : e.body.datatype.typeName === S5;
}
function lo(e, t) {
  return !!(e.inputs.some((n) => n.UnresolvedObject || n.UnresolvedPure) || !t.onlyTransactionKind && (!e.gasData.price || !e.gasData.budget || !e.gasData.payment || e.gasData.payment.length === 0 && !e.expiration));
}
async function N5(e, t, n) {
  return x5(e), lo(e, t) ? (C5(t).core?.resolveTransactionPlugin() ?? A5)(e, t, async () => {
    await Ds(e), await n();
  }) : (await Ds(e), n());
}
function Ds(e) {
  e.inputs.forEach((t, n) => {
    if (t.$kind !== "Object" && t.$kind !== "Pure" && t.$kind !== "FundsWithdrawal") throw new Error(`Input at index ${n} has not been resolved.  Expected a Pure, Object, or FundsWithdrawal input, but found ${JSON.stringify(t)}`);
  });
}
function C5(e) {
  if (!e.client) throw new Error("No sui client passed to Transaction#build, but transaction data was not sufficient to build offline.");
  return e.client;
}
function x5(e) {
  for (const t of e.commands) switch (t.$kind) {
    case "SplitCoins":
      t.SplitCoins.amounts.forEach((n) => {
        Us(n, h.U64, e);
      });
      break;
    case "TransferObjects":
      Us(t.TransferObjects.address, h.Address, e);
      break;
  }
}
function Us(e, t, n) {
  if (e.$kind !== "Input") return;
  const a = n.inputs[e.Input];
  a.$kind === "UnresolvedPure" && (n.inputs[e.Input] = g0.Pure(t.serialize(a.UnresolvedPure.value)));
}
function _5(e) {
  function t(n) {
    return e(n);
  }
  return t.system = (n) => {
    const a = n?.mutable;
    return t(a !== void 0 ? g0.SharedObjectRef({
      objectId: Bs,
      initialSharedVersion: 1,
      mutable: a
    }) : {
      $kind: "UnresolvedObject",
      UnresolvedObject: {
        objectId: Bs,
        initialSharedVersion: 1
      }
    });
  }, t.clock = () => t(g0.SharedObjectRef({
    objectId: P6,
    initialSharedVersion: 1,
    mutable: !1
  })), t.random = () => t({
    $kind: "UnresolvedObject",
    UnresolvedObject: {
      objectId: V6,
      mutable: !1
    }
  }), t.denyList = (n) => t({
    $kind: "UnresolvedObject",
    UnresolvedObject: {
      objectId: F6,
      mutable: n?.mutable
    }
  }), t.option = ({ type: n, value: a }) => (s) => s.moveCall({
    typeArguments: [n],
    target: `${io}::option::${a === null ? "none" : "some"}`,
    arguments: a === null ? [] : [s.object(a)]
  }), t;
}
function B5(e) {
  function t(n, a) {
    if (typeof n == "string") return e(yt(n).serialize(a));
    if (n instanceof Uint8Array || ua(n)) return e(n);
    throw new Error("tx.pure must be called either a bcs type name, or a serialized bcs value");
  }
  return t.u8 = (n) => e(h.U8.serialize(n)), t.u16 = (n) => e(h.U16.serialize(n)), t.u32 = (n) => e(h.U32.serialize(n)), t.u64 = (n) => e(h.U64.serialize(n)), t.u128 = (n) => e(h.U128.serialize(n)), t.u256 = (n) => e(h.U256.serialize(n)), t.bool = (n) => e(h.Bool.serialize(n)), t.string = (n) => e(h.String.serialize(n)), t.address = (n) => e(h.Address.serialize(n)), t.id = t.address, t.vector = (n, a) => e(h.vector(yt(n)).serialize(a)), t.option = (n, a) => e(h.option(yt(n)).serialize(a)), t;
}
const j5 = "2.26.1", M5 = "/", R5 = { "Mvr-Source": `@mysten/sui@${j5}` };
var D5 = class {
  #n;
  #e;
  #s;
  #a;
  constructor({ cache: e, url: t, pageSize: n = 50, overrides: a }) {
    this.#n = e, this.#e = t, this.#s = n, this.#a = {
      packages: a?.packages,
      types: a?.types
    }, U5(this.#a);
  }
  get #r() {
    return this.#n.readSync(["#mvrPackageDataLoader", this.#e ?? ""], () => {
      const e = new Rs(async (n) => {
        if (!this.#e) throw new Error(`MVR Api URL is not set for the current client (resolving ${n.join(", ")})`);
        const a = await this.#o(n);
        return n.map((s) => a[s] ?? /* @__PURE__ */ new Error(`Failed to resolve package: ${s}`));
      }), t = this.#a?.packages;
      if (t) for (const [n, a] of Object.entries(t)) e.prime(n, a);
      return e;
    });
  }
  get #i() {
    return this.#n.readSync(["#mvrTypeDataLoader", this.#e ?? ""], () => {
      const e = new Rs(async (n) => {
        if (!this.#e) throw new Error(`MVR Api URL is not set for the current client (resolving ${n.join(", ")})`);
        const a = await this.#c(n);
        return n.map((s) => a[s] ?? /* @__PURE__ */ new Error(`Failed to resolve type: ${s}`));
      }), t = this.#a?.types;
      if (t) for (const [n, a] of Object.entries(t)) e.prime(n, a);
      return e;
    });
  }
  async #o(e) {
    if (e.length === 0) return {};
    const t = bn(e, this.#s), n = {};
    return await Promise.all(t.map(async (a) => {
      const s = await this.#t("/v1/resolution/bulk", { names: a });
      if (s?.resolution)
        for (const r of Object.keys(s?.resolution)) {
          const i = s.resolution[r]?.package_id;
          i && (n[r] = i);
        }
    })), n;
  }
  async #c(e) {
    if (e.length === 0) return {};
    const t = bn(e, this.#s), n = {};
    return await Promise.all(t.map(async (a) => {
      const s = await this.#t("/v1/struct-definition/bulk", { types: a });
      if (s?.resolution)
        for (const r of Object.keys(s?.resolution)) {
          const i = s.resolution[r]?.type_tag;
          i && (n[r] = i);
        }
    })), n;
  }
  async #t(e, t) {
    if (!this.#e) throw new Error("MVR Api URL is not set for the current client");
    const n = await fetch(`${this.#e}${e}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...R5
      },
      body: JSON.stringify(t)
    });
    if (!n.ok) {
      const a = await n.json().catch(() => ({}));
      throw new Error(`Failed to resolve types: ${a?.message}`);
    }
    return n.json();
  }
  async resolvePackage({ package: e, signal: t }) {
    return t?.throwIfAborted(), X0(e) ? { package: await en(this.#r.load(e), t) } : { package: e };
  }
  async resolveType({ type: e, signal: t }) {
    if (t?.throwIfAborted(), !X0(e)) return { type: e };
    const n = [...pn(e)], a = await en(this.#i.loadMany(n), t), s = {};
    for (let r = 0; r < n.length; r++) {
      const i = a[r];
      if (i instanceof Error) throw i;
      s[n[r]] = i;
    }
    return { type: mn(e, s) };
  }
  async resolve({ types: e = [], packages: t = [], signal: n }) {
    n?.throwIfAborted();
    const a = /* @__PURE__ */ new Set();
    for (const f of e ?? []) pn(f, a);
    const s = [...a], [r, i] = await en(Promise.all([s.length > 0 ? this.#i.loadMany(s) : [], t.length > 0 ? this.#r.loadMany(t) : []]), n), o = { ...this.#a?.types };
    for (const [f, l] of s.entries()) {
      const b = r[f];
      if (b instanceof Error) throw b;
      o[l] = b;
    }
    const c = {};
    for (const f of e ?? []) c[f] = { type: mn(f, o) };
    const u = {};
    for (const [f, l] of (t ?? []).entries()) {
      const b = this.#a?.packages?.[l] ?? i[f];
      if (b instanceof Error) throw b;
      u[l] = { package: b };
    }
    return {
      types: c,
      packages: u
    };
  }
};
function U5(e) {
  if (e?.packages) for (const [t, n] of Object.entries(e.packages)) {
    if (!Dt(t)) throw new Error(`Invalid package name: ${t}`);
    if (!Ct(j(n))) throw new Error(`Invalid package ID: ${n}`);
  }
  if (e?.types) for (const [t, n] of Object.entries(e.types)) {
    if (je(t).typeParams.length > 0) throw new Error("Type overrides must be first-level only. If you want to supply generic types, just pass each type individually.");
    if (!Ct(je(n).address)) throw new Error(`Invalid type: ${n}`);
  }
}
function pn(e, t = /* @__PURE__ */ new Set()) {
  if (typeof e == "string" && !X0(e)) return t;
  if (typeof e == "string" && e.startsWith("vector<") && e.endsWith(">")) return pn(e.slice(7, -1), t);
  const n = bo(e) ? e : je(e);
  X0(n.address) && t.add(`${n.address}::${n.module}::${n.name}`);
  for (const a of n.typeParams) pn(a, t);
  return t;
}
function mn(e, t) {
  if (typeof e == "string" && !e.includes("::")) return e;
  if (typeof e == "string" && e.startsWith("vector<") && e.endsWith(">")) return `vector<${mn(e.slice(7, -1), t)}>`;
  const n = bo(e) ? e : je(e), a = t[`${n.address}::${n.module}::${n.name}`];
  return Z0({
    ...n,
    address: a ? a.split("::")[0] : n.address,
    typeParams: n.typeParams.map((s) => mn(s, t))
  });
}
function X0(e) {
  return e.includes(M5) || e.includes("@") || e.includes(".sui");
}
function en(e, t) {
  return t ? t.aborted ? Promise.reject(t.reason) : new Promise((n, a) => {
    const s = () => a(t.reason);
    t.addEventListener("abort", s, { once: !0 }), e.then(n, a).finally(() => {
      t.removeEventListener("abort", s);
    });
  }) : e;
}
function bo(e) {
  return typeof e == "object" && "address" in e && "module" in e && "name" in e && "typeParams" in e;
}
function P5(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const a of e.commands) switch (a.$kind) {
    case "MakeMoveVec":
      a.MakeMoveVec.type && Ps([a.MakeMoveVec.type]).forEach((i) => {
        n.add(i);
      });
      break;
    case "MoveCall":
      const s = a.MoveCall, r = s.package.split("::")[0];
      if (X0(r)) {
        if (!Dt(r)) throw new Error(`Invalid package name: ${r}`);
        t.add(r);
      }
      Ps(s.typeArguments ?? []).forEach((i) => {
        n.add(i);
      });
      break;
  }
  return {
    packages: [...t],
    types: [...n]
  };
}
function V5(e, t) {
  for (const n of e.commands) {
    if (n.MakeMoveVec?.type) {
      if (!X0(n.MakeMoveVec.type)) continue;
      if (!t.types[n.MakeMoveVec.type]) throw new Error(`No resolution found for type: ${n.MakeMoveVec.type}`);
      n.MakeMoveVec.type = t.types[n.MakeMoveVec.type].type;
    }
    const a = n.MoveCall;
    if (!a) continue;
    const s = a.package.split("::"), r = s[0];
    if (X0(r) && !t.packages[r]) throw new Error(`No address found for package: ${r}`);
    X0(r) && (s[0] = t.packages[r].package, a.package = s.join("::"));
    const i = a.typeArguments;
    if (i) {
      for (let o = 0; o < i.length; o++)
        if (X0(i[o])) {
          if (!t.types[i[o]]) throw new Error(`No resolution found for type: ${i[o]}`);
          i[o] = t.types[i[o]].type;
        }
      a.typeArguments = i;
    }
  }
}
function Ps(e) {
  const t = /* @__PURE__ */ new Set();
  for (const n of e) if (X0(n)) {
    if (!xd(n)) throw new Error(`Invalid type with names: ${n}`);
    t.add(n);
  }
  return t;
}
function F5() {
  return async (e, t, n) => {
    const a = P5(e);
    if (a.types.length === 0 && a.packages.length === 0) return n();
    if (!t.client) throw new Error("Transaction contains MVR names but no client was provided to resolve them. Please pass a client to Transaction#build()");
    V5(e, await t.client.core.mvr.resolve({
      types: a.types,
      packages: a.packages
    })), await n();
  };
}
function qn(e, t = 1 / 0) {
  const n = {
    $kind: "Result",
    get Result() {
      return typeof e == "function" ? e() : e;
    }
  }, a = [], s = (r) => a[r] ??= {
    $kind: "NestedResult",
    get NestedResult() {
      return [typeof e == "function" ? e() : e, r];
    }
  };
  return new Proxy(n, {
    set() {
      throw new Error("The transaction result is a proxy, and does not support setting properties directly");
    },
    get(r, i) {
      if (i in r) return Reflect.get(r, i);
      if (i === Symbol.iterator) return function* () {
        let c = 0;
        for (; c < t; )
          yield s(c), c++;
      };
      if (typeof i == "symbol") return;
      const o = parseInt(i, 10);
      if (!(Number.isNaN(o) || o < 0))
        return s(o);
    }
  });
}
const po = Symbol.for("@mysten/transaction");
function $5(e) {
  return !!e && typeof e == "object" && e[po] === !0;
}
var _n = class tn {
  #n;
  #e;
  #s = /* @__PURE__ */ new Map();
  #a = [];
  #r = [];
  #i = /* @__PURE__ */ new Set();
  #o = /* @__PURE__ */ new Set();
  #c = /* @__PURE__ */ new Map();
  /**
  * Converts from a serialize transaction kind (built with `build({ onlyTransactionKind: true })`) to a `Transaction` class.
  * Supports either a byte array, or base64-encoded bytes.
  */
  static fromKind(t) {
    const n = new tn();
    return n.#t = tt.fromKindBytes(typeof t == "string" ? j0(t) : t), n.#a = n.#t.inputs.slice(), n.#r = n.#t.commands.slice(), n.#i = new Set(n.#r.map((a, s) => s)), n;
  }
  /**
  * Converts from a serialized transaction format to a `Transaction` class.
  * There are two supported serialized formats:
  * - A string returned from `Transaction#serialize`. The serialized format must be compatible, or it will throw an error.
  * - A byte array (or base64-encoded bytes) containing BCS transaction data.
  *
  * When copying an in-memory transaction that uses custom intents, pass resolvers for those intents
  * via `options.intentResolvers` so the copy can be created synchronously without first awaiting
  * `prepareForSerialization`. Built-in intents (such as `CoinWithBalance`) are handled automatically.
  */
  static from(t, n = {}) {
    const a = new tn();
    $5(t) ? a.#t = tt.restore(t.getData()) : typeof t != "string" || !t.startsWith("{") ? a.#t = tt.fromBytes(typeof t == "string" ? j0(t) : t) : a.#t = tt.restore(JSON.parse(t)), a.#a = a.#t.inputs.slice(), a.#r = a.#t.commands.slice(), a.#i = new Set(a.#r.map((r, i) => i));
    const s = new Map([[Ye, Ga], ...Object.entries(n.intentResolvers ?? {})]);
    if (!a.isPreparedForSerialization({ supportedIntents: [...s.keys()] })) throw new Error("Transaction has unresolved intents or async thunks. Provide resolvers for any custom intents via the `intentResolvers` option, or call `prepareForSerialization` before copying.");
    for (const [r, i] of s) a.addIntentResolver(r, i);
    return a;
  }
  addSerializationPlugin(t) {
    this.#n.push(t);
  }
  addBuildPlugin(t) {
    this.#e.push(t);
  }
  addIntentResolver(t, n) {
    if (this.#s.has(t) && this.#s.get(t) !== n) throw new Error(`Intent resolver for ${t} already exists`);
    this.#s.set(t, n);
  }
  setSender(t) {
    this.#t.sender = t;
  }
  /**
  * Sets the sender only if it has not already been set.
  * This is useful for sponsored transaction flows where the sender may not be the same as the signer address.
  */
  setSenderIfNotSet(t) {
    this.#t.sender || (this.#t.sender = t);
  }
  setExpiration(t) {
    this.#t.expiration = t ? q(Ti, t) : null;
  }
  setGasPrice(t) {
    this.#t.gasData.price = String(t);
  }
  setGasBudget(t) {
    this.#t.gasData.budget = String(t);
  }
  setGasBudgetIfNotSet(t) {
    this.#t.gasData.budget == null && (this.#t.gasData.budget = String(t));
  }
  setGasOwner(t) {
    this.#t.gasData.owner = t;
  }
  setGasPayment(t) {
    this.#t.gasData.payment = t.map((n) => q(Me, n));
  }
  #t;
  /** Get a snapshot of the transaction data, in JSON form: */
  getData() {
    return this.#t.snapshot();
  }
  get [po]() {
    return !0;
  }
  get pure() {
    return Object.defineProperty(this, "pure", {
      enumerable: !1,
      value: B5((t) => ua(t) ? this.#d("pure", {
        $kind: "Pure",
        Pure: { bytes: t.toBase64() }
      }) : this.#d("pure", /* @__PURE__ */ ba(Is, t) ? q(Is, t) : t instanceof Uint8Array ? g0.Pure(t) : {
        $kind: "UnresolvedPure",
        UnresolvedPure: { value: t }
      }))
    }), this.pure;
  }
  constructor() {
    this.object = _5((t) => {
      if (typeof t == "function") return this.object(this.add(t));
      if (typeof t == "object" && /* @__PURE__ */ ba(H, t)) return t;
      const n = dn(t), a = this.#t.inputs.find((s) => n === dn(s));
      return a?.Object?.SharedObject && typeof t == "object" && t.Object?.SharedObject && (a.Object.SharedObject.mutable = a.Object.SharedObject.mutable || t.Object.SharedObject.mutable), a ? {
        $kind: "Input",
        Input: this.#t.inputs.indexOf(a),
        type: "object"
      } : this.#d("object", typeof t == "string" ? {
        $kind: "UnresolvedObject",
        UnresolvedObject: { objectId: j(t) }
      } : t);
    }), this.#t = new tt(), this.#e = [], this.#n = [];
  }
  /** Returns an argument for the gas coin, to be used in a transaction. */
  get gas() {
    return {
      $kind: "GasCoin",
      GasCoin: !0
    };
  }
  /**
  * Creates a coin of the specified type and balance.
  * Sourced from address balance when available, falling back to owned coins.
  */
  coin({ type: t, balance: n, useGasCoin: a }) {
    return this.add(L6({
      type: t,
      balance: n,
      useGasCoin: a
    }));
  }
  /**
  * Creates a Balance object of the specified type and balance.
  * Sourced from address balance when available, falling back to owned coins.
  */
  balance({ type: t, balance: n, useGasCoin: a }) {
    return this.add(z6({
      type: t,
      balance: n,
      useGasCoin: a
    }));
  }
  /**
  * Add a new object input to the transaction using the fully-resolved object reference.
  * If you only have an object ID, use `builder.object(id)` instead.
  */
  objectRef(...t) {
    return this.object(g0.ObjectRef(...t));
  }
  /**
  * Add a new receiving input to the transaction using the fully-resolved object reference.
  * If you only have an object ID, use `builder.object(id)` instead.
  */
  receivingRef(...t) {
    return this.object(g0.ReceivingRef(...t));
  }
  /**
  * Add a new shared object input to the transaction using the fully-resolved shared object reference.
  * If you only have an object ID, use `builder.object(id)` instead.
  */
  sharedObjectRef(...t) {
    return this.object(g0.SharedObjectRef(...t));
  }
  #m() {
    const t = new tn();
    return t.#t = this.#t, t.#n = this.#n, t.#e = this.#e, t.#s = this.#s, t.#o = this.#o, t.#i = new Set(this.#i), t.#c = this.#c, this.#a.push(t.#a), this.#r.push(t.#r), t;
  }
  add(t) {
    if (typeof t == "function") {
      if (this.#c.has(t)) return this.#c.get(t);
      const n = this.#m(), a = t(n);
      if (!(a && typeof a == "object" && "then" in a))
        return this.#i = n.#i, this.#c.set(t, a), a;
      const s = this.#f({
        $kind: "$Intent",
        $Intent: {
          name: "AsyncTransactionThunk",
          inputs: {},
          data: {
            resultIndex: this.#t.commands.length,
            result: null
          }
        }
      });
      this.#o.add(Promise.resolve(a).then((i) => {
        s.$Intent.data.result = i;
      }));
      const r = qn(() => s.$Intent.data.resultIndex);
      return this.#c.set(t, r), r;
    } else this.#f(t);
    return qn(this.#t.commands.length - 1);
  }
  #f(t) {
    const n = this.#t.commands.length;
    return this.#r.push(t), this.#i.add(n), this.#t.commands.push(t), this.#t.mapCommandArguments(n, (a) => {
      if (a.$kind === "Result" && !this.#i.has(a.Result)) throw new Error(`Result { Result: ${a.Result} } is not available to use in the current transaction`);
      if (a.$kind === "NestedResult" && !this.#i.has(a.NestedResult[0])) throw new Error(`Result { NestedResult: [${a.NestedResult[0]}, ${a.NestedResult[1]}] } is not available to use in the current transaction`);
      if (a.$kind === "Input" && a.Input >= this.#t.inputs.length) throw new Error(`Input { Input: ${a.Input} } references an input that does not exist in the current transaction`);
      return a;
    }), t;
  }
  #d(t, n) {
    return this.#a.push(n), this.#t.addInput(t, n);
  }
  #u(t) {
    return ua(t) ? this.pure(t) : this.#l(t);
  }
  #l(t) {
    if (typeof t == "function") {
      const n = this.add(t);
      return typeof n == "function" ? this.#l(n) : q(H, n);
    }
    return q(H, t);
  }
  splitCoins(t, n) {
    const a = p0.SplitCoins(typeof t == "string" ? this.object(t) : this.#l(t), n.map((s) => typeof s == "number" || typeof s == "bigint" || typeof s == "string" ? this.pure.u64(s) : this.#u(s)));
    return this.#f(a), qn(this.#t.commands.length - 1, n.length);
  }
  mergeCoins(t, n) {
    return this.add(p0.MergeCoins(this.object(t), n.map((a) => this.object(a))));
  }
  publish({ modules: t, dependencies: n }) {
    return this.add(p0.Publish({
      modules: t,
      dependencies: n
    }));
  }
  upgrade({ modules: t, dependencies: n, package: a, ticket: s }) {
    return this.add(p0.Upgrade({
      modules: t,
      dependencies: n,
      package: a,
      ticket: this.object(s)
    }));
  }
  moveCall({ arguments: t, ...n }) {
    return this.add(p0.MoveCall({
      ...n,
      arguments: t?.map((a) => this.#u(a))
    }));
  }
  transferObjects(t, n) {
    return this.add(p0.TransferObjects(t.map((a) => this.object(a)), typeof n == "string" ? this.pure.address(n) : this.#u(n)));
  }
  makeMoveVec({ type: t, elements: n }) {
    return this.add(p0.MakeMoveVec({
      type: t,
      elements: n.map((a) => this.object(a))
    }));
  }
  /**
  * Create a FundsWithdrawal input for withdrawing Balance<T> from an address balance accumulator.
  * This is used for gas payments from address balances.
  *
  * @param options.amount - The Amount to withdraw (u64).
  * @param options.type - The balance type (e.g., "0x2::sui::SUI"). Defaults to SUI.
  */
  withdrawal({ amount: t, type: n }) {
    const a = {
      $kind: "FundsWithdrawal",
      FundsWithdrawal: {
        reservation: {
          $kind: "MaxAmountU64",
          MaxAmountU64: String(t)
        },
        typeArg: {
          $kind: "Balance",
          Balance: n ?? "0x2::sui::SUI"
        },
        withdrawFrom: {
          $kind: "Sender",
          Sender: !0
        }
      }
    };
    return this.#d("object", a);
  }
  /**
  * @deprecated Use toJSON instead.
  * For synchronous serialization, you can use `getData()`
  * */
  serialize() {
    return JSON.stringify(v6(this.#t.snapshot()));
  }
  async toJSON(t = {}) {
    await this.prepareForSerialization(t);
    const n = this.isFullyResolved();
    return JSON.stringify(q(H6, n ? {
      ...this.#t.snapshot(),
      digest: this.#t.getDigest()
    } : this.#t.snapshot()), (a, s) => typeof s == "bigint" ? s.toString() : s, 2);
  }
  /** Build the transaction to BCS bytes, and sign it with the provided keypair. */
  async sign(t) {
    const { signer: n, ...a } = t, s = await this.build(a);
    return n.signTransaction(s);
  }
  /**
  * Checks if the transaction is prepared for serialization to JSON.
  * This means:
  *  - All async thunks have been fully resolved
  *  - All transaction intents have been resolved (unless in supportedIntents)
  *
  * Unlike `isFullyResolved()`, this does not require the sender, gas payment,
  * budget, or object versions to be set.
  */
  isPreparedForSerialization(t = {}) {
    return !(this.#o.size > 0 || this.#t.commands.some((n) => n.$Intent && !t.supportedIntents?.includes(n.$Intent.name)));
  }
  /**
  *  Ensures that:
  *  - All objects have been fully resolved to a specific version
  *  - All pure inputs have been serialized to bytes
  *  - All async thunks have been fully resolved
  *  - All transaction intents have been resolved
  * 	- The gas payment, budget, and price have been set
  *  - The transaction sender has been set
  *
  *  When true, the transaction will always be built to the same bytes and digest (unless the transaction is mutated)
  */
  isFullyResolved() {
    return !(!this.isPreparedForSerialization() || !this.#t.sender || lo(this.#t, {}));
  }
  /** Build the transaction to BCS bytes. */
  async build(t = {}) {
    return await this.prepareForSerialization(t), await this.#b(t), this.#t.build({ onlyTransactionKind: t.onlyTransactionKind });
  }
  /** Derive transaction digest */
  async getDigest(t = {}) {
    return await this.prepareForSerialization(t), await this.#b(t), this.#t.getDigest();
  }
  /**
  * Prepare the transaction by validating the transaction data and resolving all inputs
  * so that it can be built into bytes.
  */
  async #b(t) {
    if (!t.onlyTransactionKind && !this.#t.sender) throw new Error("Missing transaction sender");
    await this.#p([...this.#e, N5], t);
  }
  async #p(t, n) {
    try {
      const a = (s) => {
        if (s >= t.length) return () => {
        };
        const r = t[s];
        return async () => {
          const i = a(s + 1);
          let o = !1, c = !1;
          if (await r(this.#t, n, async () => {
            if (o) throw new Error(`next() was call multiple times in TransactionPlugin ${s}`);
            o = !0, await i(), c = !0;
          }), !o) throw new Error(`next() was not called in TransactionPlugin ${s}`);
          if (!c) throw new Error(`next() was not awaited in TransactionPlugin ${s}`);
        };
      };
      await a(0)();
    } finally {
      this.#a = this.#t.inputs.slice(), this.#r = this.#t.commands.slice(), this.#i = new Set(this.#r.map((a, s) => s));
    }
  }
  async #g() {
    for (; this.#o.size > 0; ) {
      const t = Promise.all(this.#o);
      this.#o.clear(), this.#o.add(t), await t, this.#o.delete(t);
    }
  }
  #h() {
    const t = this.#t.commands, n = this.#t.inputs, a = this.#r.flat(1 / 0), s = this.#a.flat(1 / 0);
    if (a.length !== t.length) throw new Error("Unexpected number of commands found in transaction data");
    if (s.length !== n.length) throw new Error("Unexpected number of inputs found in transaction data");
    const r = a.filter((o) => o.$Intent?.name !== "AsyncTransactionThunk");
    this.#t.commands = r, this.#t.inputs = s, this.#r = r, this.#a = s, this.#i = new Set(r.map((o, c) => c));
    function i(o) {
      const c = t[o];
      if (c.$Intent?.name === "AsyncTransactionThunk") {
        const f = c.$Intent.data.result;
        if (f == null) throw new Error("AsyncTransactionThunk has not been resolved");
        return i(f.Result);
      }
      const u = r.indexOf(c);
      if (u === -1) throw new Error("Unable to find original index for command");
      return u;
    }
    this.#t.mapArguments((o) => {
      if (o.$kind === "Input") {
        const c = s.indexOf(n[o.Input]);
        if (c === -1) throw new Error("Input has not been resolved");
        return {
          ...o,
          Input: c
        };
      } else if (o.$kind === "Result") {
        const c = i(o.Result);
        return {
          ...o,
          Result: c
        };
      } else if (o.$kind === "NestedResult") {
        const c = i(o.NestedResult[0]);
        return {
          ...o,
          NestedResult: [c, o.NestedResult[1]]
        };
      }
      return o;
    });
    for (const [o, c] of t.entries()) if (c.$Intent?.name === "AsyncTransactionThunk") try {
      c.$Intent.data.resultIndex = i(o);
    } catch {
    }
  }
  async prepareForSerialization(t) {
    await this.#g(), this.#h();
    const n = /* @__PURE__ */ new Set();
    for (const s of this.#t.commands) s.$Intent && n.add(s.$Intent.name);
    const a = [...this.#n];
    for (const s of n)
      if (!t.supportedIntents?.includes(s)) {
        if (!this.#s.has(s)) throw new Error(`Missing intent resolver for ${s}`);
        a.push(this.#s.get(s));
      }
    a.push(F5()), await this.#p(a, t);
  }
}, L5 = class mo {
  #n;
  #e;
  constructor({ prefix: t, cache: n } = {}) {
    this.#n = t ?? [], this.#e = n ?? /* @__PURE__ */ new Map();
  }
  read(t, n) {
    const a = [this.#n, ...t].join(":");
    if (this.#e.has(a)) return this.#e.get(a);
    const s = n();
    return this.#e.set(a, s), typeof s == "object" && s !== null && "then" in s ? Promise.resolve(s).then((r) => (this.#e.set(a, r), r)).catch((r) => {
      throw this.#e.delete(a), r;
    }) : s;
  }
  readSync(t, n) {
    const a = [this.#n, ...t].join(":");
    if (this.#e.has(a)) return this.#e.get(a);
    const s = n();
    return this.#e.set(a, s), s;
  }
  clear(t) {
    const n = [...this.#n, ...t ?? []].join(":");
    if (!n) {
      this.#e.clear();
      return;
    }
    for (const a of this.#e.keys()) a.startsWith(n) && this.#e.delete(a);
  }
  scope(t) {
    return new mo({
      prefix: [...this.#n, ...Array.isArray(t) ? t : [t]],
      cache: this.#e
    });
  }
}, go = class {
  constructor({ network: e, base: t, cache: n = t?.cache ?? new L5() }) {
    this.network = e, this.base = t ?? this, this.cache = n;
  }
  $extend(...e) {
    const t = Object.fromEntries(e.map((a) => [a.name, a.register(this)])), n = /* @__PURE__ */ new Map();
    return new Proxy(this, { get(a, s, r) {
      if (typeof s == "string" && s in t) return t[s];
      const i = Reflect.get(a, s, r);
      return typeof i == "function" ? s === "$extend" ? i.bind(r) : (n.has(s) || n.set(s, i.bind(a)), n.get(s)) : i;
    } });
  }
};
let ho = /* @__PURE__ */ function(e) {
  return e.Failure = "FAILURE", e.Success = "SUCCESS", e;
}({}), Vs = /* @__PURE__ */ function(e) {
  return e.PersonalMessage = "PERSONAL_MESSAGE", e.TransactionData = "TRANSACTION_DATA", e;
}({});
var X = class extends String {
  constructor(e, t) {
    super(e), this.value = e, this.__meta__ = t;
  }
  toString() {
    return this.value;
  }
};
new X(`
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}
    `, { fragmentName: "OBJECT_OWNER_FIELDS" });
new X(`
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  asMoveObject {
    contents {
      bcs @include(if: $includeContent)
      json @include(if: $includeJson)
      display @include(if: $includeDisplay) {
        output
        errors
      }
      type {
        repr
      }
    }
  }
  asMovePackage {
    __typename
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`, { fragmentName: "OBJECT_FIELDS" });
new X(`
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  contents {
    bcs @include(if: $includeContent)
    json @include(if: $includeJson)
    display @include(if: $includeDisplay) {
      output
      errors
    }
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`, { fragmentName: "MOVE_OBJECT_FIELDS" });
new X(`
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}
    `, { fragmentName: "TRANSACTION_FIELDS" });
const z5 = new X(`
    query getAllBalances($owner: SuiAddress!, $limit: Int, $cursor: String) {
  address(address: $owner) {
    balances(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        coinType {
          repr
        }
        totalBalance
        addressBalance
      }
    }
  }
}
    `), G5 = new X(`
    query getBalance($owner: SuiAddress!, $coinType: String = "0x2::sui::SUI") {
  address(address: $owner) {
    balance(coinType: $coinType) {
      coinType {
        repr
      }
      totalBalance
      addressBalance
    }
  }
}
    `), W5 = new X(`
    query getChainIdentifier {
  checkpoint(sequenceNumber: 0) {
    digest
  }
}
    `), Q5 = new X(`
    query getCoinMetadata($coinType: String!) {
  coinMetadata(coinType: $coinType) {
    address
    decimals
    name
    symbol
    description
    iconUrl
  }
}
    `), J5 = new X(`
    query getCoins($owner: SuiAddress!, $first: Int, $cursor: String, $type: String = "0x2::coin::Coin<0x2::sui::SUI>") {
  address(address: $owner) {
    address
    objects(first: $first, after: $cursor, filter: {type: $type}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        owner {
          ...OBJECT_OWNER_FIELDS
        }
        contents {
          json
          type {
            repr
          }
        }
        address
        version
        digest
      }
    }
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`), Y5 = new X(`
    query getCurrentSystemState {
  epoch {
    epochId
    referenceGasPrice
    startTimestamp
    protocolConfigs {
      protocolVersion
    }
    systemState {
      json
    }
  }
}
    `), Z5 = new X(`
    query getDynamicFields($parentId: SuiAddress!, $first: Int, $cursor: String, $includeValue: Boolean = false) {
  address(address: $parentId) {
    dynamicFields(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name {
          bcs
          type {
            repr
          }
        }
        value {
          __typename
          ... on MoveValue {
            bcs @include(if: $includeValue)
            type {
              repr
            }
          }
          ... on MoveObject {
            address
            contents {
              bcs @include(if: $includeValue)
              type {
                repr
              }
            }
          }
        }
      }
    }
  }
}
    `), q5 = new X(`
    query getMoveFunction($package: SuiAddress!, $module: String!, $function: String!) {
  package(address: $package) {
    module(name: $module) {
      function(name: $function) {
        name
        visibility
        isEntry
        typeParameters {
          constraints
        }
        parameters {
          signature
        }
        return {
          signature
        }
      }
    }
  }
}
    `), H5 = new X(`
    query getProtocolConfig {
  epoch {
    protocolConfigs {
      protocolVersion
      featureFlags {
        key
        value
      }
      configs {
        key
        value
      }
    }
  }
}
    `), X5 = new X(`
    query getReferenceGasPrice {
  epoch {
    referenceGasPrice
  }
}
    `), K5 = new X(`
    query listEvents($filter: EventFilter, $first: Int, $after: String, $last: Int, $before: String) {
  events(
    filter: $filter
    first: $first
    after: $after
    last: $last
    before: $before
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      sequenceNumber
      transaction {
        digest
        effects {
          checkpoint {
            sequenceNumber
          }
        }
      }
      transactionModule {
        package {
          address
        }
        name
      }
      sender {
        address
      }
      contents {
        type {
          repr
        }
        bcs
        json
      }
    }
  }
}
    `), eu = new X(`
    query defaultSuinsName($address: SuiAddress!) {
  address(address: $address) {
    defaultNameRecord {
      domain
    }
  }
}
    `), tu = new X(`
    query resolveNameServiceAddress($name: String!) {
  address(name: $name) {
    address
  }
}
    `), nu = new X(`
    query getOwnedObjects($owner: SuiAddress!, $limit: Int, $cursor: String, $filter: ObjectFilter, $includeContent: Boolean = false, $includePreviousTransaction: Boolean = false, $includeObjectBcs: Boolean = false, $includeJson: Boolean = false, $includeDisplay: Boolean = false) {
  address(address: $owner) {
    objects(first: $limit, after: $cursor, filter: $filter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...MOVE_OBJECT_FIELDS
      }
    }
  }
}
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  contents {
    bcs @include(if: $includeContent)
    json @include(if: $includeJson)
    display @include(if: $includeDisplay) {
      output
      errors
    }
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`), au = new X(`
    query multiGetObjects($objectKeys: [ObjectKey!]!, $includeContent: Boolean = false, $includePreviousTransaction: Boolean = false, $includeObjectBcs: Boolean = false, $includeJson: Boolean = false, $includeDisplay: Boolean = false) {
  multiGetObjects(keys: $objectKeys) {
    ...OBJECT_FIELDS
  }
}
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  asMoveObject {
    contents {
      bcs @include(if: $includeContent)
      json @include(if: $includeJson)
      display @include(if: $includeDisplay) {
        output
        errors
      }
      type {
        repr
      }
    }
  }
  asMovePackage {
    __typename
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`), su = new X(`
    query simulateTransaction($transaction: JSON!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeCommandResults: Boolean = false, $includeBcs: Boolean = false, $doGasSelection: Boolean = false, $checksEnabled: Boolean = true) {
  simulateTransaction(
    transaction: $transaction
    doGasSelection: $doGasSelection
    checksEnabled: $checksEnabled
  ) {
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
    outputs @include(if: $includeCommandResults) {
      returnValues {
        value {
          bcs
        }
      }
      mutatedReferences {
        value {
          bcs
        }
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), ru = new X(`
    mutation executeTransaction($transactionDataBcs: Base64!, $signatures: [Base64!]!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  executeTransaction(
    transactionDataBcs: $transactionDataBcs
    signatures: $signatures
  ) {
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), iu = new X(`
    query getTransactionBlock($digest: String!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  transaction(digest: $digest) {
    ...TRANSACTION_FIELDS
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), ou = new X(`
    query listTransactions($filter: TransactionFilter, $first: Int, $after: String, $last: Int, $before: String, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  transactions(
    filter: $filter
    first: $first
    after: $after
    last: $last
    before: $before
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      ...TRANSACTION_FIELDS
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), cu = new X(`
    query resolveTransaction($transaction: JSON!, $doGasSelection: Boolean = true, $checksEnabled: Boolean = true) {
  simulateTransaction(
    transaction: $transaction
    doGasSelection: $doGasSelection
    checksEnabled: $checksEnabled
  ) {
    effects {
      transaction {
        transactionBcs
        effects {
          epoch {
            epochId
          }
          status
          executionError {
            message
            abortCode
            identifier
            constant
            sourceLineNumber
            instructionOffset
            module {
              name
              package {
                address
              }
            }
            function {
              name
            }
          }
        }
      }
    }
  }
}
    `), du = new X(`
    query verifyZkLoginSignature($bytes: Base64!, $signature: Base64!, $intentScope: ZkLoginIntentScope!, $author: SuiAddress!) {
  verifyZkLoginSignature(
    bytes: $bytes
    signature: $signature
    intentScope: $intentScope
    author: $author
  ) {
    success
  }
}
    `), fu = {
  mainnet: "https://mainnet.mvr.mystenlabs.com",
  testnet: "https://testnet.mvr.mystenlabs.com"
};
var uu = class extends go {
  constructor(e) {
    super(e), this.core = this, this.mvr = new D5({
      cache: this.cache.scope("core.mvr"),
      url: e.mvr?.url ?? fu[this.network],
      pageSize: e.mvr?.pageSize,
      overrides: e.mvr?.overrides
    });
  }
  async getObject(e) {
    const { objectId: t } = e, { objects: [n] } = await this.getObjects({
      objectIds: [t],
      signal: e.signal,
      include: e.include
    });
    if (n instanceof Error) throw n;
    return { object: n };
  }
  async getDynamicField(e) {
    const t = it.parseFromStr((await this.core.mvr.resolveType({
      type: e.name.type,
      signal: e.signal
    })).type), n = Vt(e.parentId, t, e.name.bcs), { objects: [a] } = await this.getObjects({
      objectIds: [n],
      signal: e.signal,
      include: {
        previousTransaction: !0,
        content: !0
      }
    });
    if (a instanceof Error) throw a;
    const s = je(a.type), r = await a.content, i = s.typeParams[0], o = typeof i != "string" && i.module === "dynamic_object_field" && i.name === "Wrapper", c = r.slice(kn + e.name.bcs.length), u = typeof s.typeParams[1] == "string" ? s.typeParams[1] : Z0(s.typeParams[1]);
    return { dynamicField: {
      $kind: o ? "DynamicObject" : "DynamicField",
      fieldId: a.objectId,
      digest: a.digest,
      version: a.version,
      type: a.type,
      previousTransaction: a.previousTransaction,
      name: {
        type: typeof i == "string" ? i : Z0(i),
        bcs: e.name.bcs
      },
      value: {
        type: u,
        bcs: c
      },
      childId: o ? h.Address.parse(c) : void 0
    } };
  }
  async getDynamicObjectField(e) {
    const t = `0x2::dynamic_object_field::Wrapper<${(await this.core.mvr.resolveType({
      type: e.name.type,
      signal: e.signal
    })).type}>`, { dynamicField: n } = await this.getDynamicField({
      parentId: e.parentId,
      name: {
        type: t,
        bcs: e.name.bcs
      },
      signal: e.signal
    }), { object: a } = await this.getObject({
      objectId: n.childId,
      signal: e.signal,
      include: e.include
    });
    return { object: a };
  }
  async waitForTransaction(e) {
    const { signal: t, timeout: n = 60 * 1e3, pollSchedule: a, include: s } = e, r = "result" in e && e.result ? (e.result.Transaction ?? e.result.FailedTransaction).digest : e.digest, i = t ? AbortSignal.any([AbortSignal.timeout(n), t]) : AbortSignal.timeout(n), o = new Promise((b, g) => {
      i.addEventListener("abort", () => g(i.reason));
    });
    o.catch(() => {
    });
    const c = a ?? [
      0,
      300,
      600,
      1500,
      3500
    ], u = Date.now();
    let f = 0;
    const l = c.length > 0 ? c[c.length - 1] - (c[c.length - 2] ?? 0) : 2e3;
    for (; ; ) {
      if (f < c.length) {
        const b = u + c[f] - Date.now();
        f++, b > 0 && await Promise.race([new Promise((g) => setTimeout(g, b)), o]);
      } else await Promise.race([new Promise((b) => setTimeout(b, l)), o]);
      i.throwIfAborted();
      try {
        return await this.getTransaction({
          digest: r,
          include: s,
          signal: i
        });
      } catch {
      }
    }
  }
  async signAndExecuteTransaction({ transaction: e, signer: t, additionalSignatures: n = [], ...a }) {
    let s;
    e instanceof Uint8Array ? s = e : (e.setSenderIfNotSet(t.toSuiAddress()), s = await e.build({ client: this }));
    const { signature: r } = await t.signTransaction(s);
    return this.executeTransaction({
      transaction: s,
      signatures: [r, ...n],
      ...a
    });
  }
};
const lu = new Intl.PluralRules("en-US", { type: "ordinal" }), bu = /* @__PURE__ */ new Map([
  ["one", "st"],
  ["two", "nd"],
  ["few", "rd"],
  ["other", "th"]
]);
function pu(e) {
  return `${e}${bu.get(lu.select(e))}`;
}
function Ao(e) {
  const { command: t, location: n, abortCode: a, cleverError: s } = e, r = [];
  if (t != null ? r.push(`MoveAbort in ${pu(t + 1)} command`) : r.push("MoveAbort"), s?.constantName) {
    const i = s.value ? `'${s.constantName}': ${s.value}` : `'${s.constantName}'`;
    r.push(i);
  } else r.push(`abort code: ${a}`);
  if (n?.package && n?.module) {
    const i = [`in '${[
      n.package.startsWith("0x") ? n.package : `0x${n.package}`,
      n.module,
      n.functionName
    ].filter(Boolean).join("::")}'`];
    s?.lineNumber != null ? i.push(`(line ${s.lineNumber})`) : n.instruction != null && i.push(`(instruction ${n.instruction})`), r.push(i.join(" "));
  }
  return r.join(", ");
}
const Fs = h.struct("MinimalEffectsWithError", { status: $a });
h.enum("MinimalTransactionEffectsWithError", {
  V1: Fs,
  V2: Fs
});
const mu = h.enum("MinimalExecutionStatusNoError", {
  Success: null,
  Failed: null
}), $s = h.struct("MinimalEffectsNoError", { status: mu });
h.enum("MinimalTransactionEffectsNoError", {
  V1: $s,
  V2: $s
});
function E0(e, t) {
  return t != null && typeof t != "boolean" ? `${e}(${JSON.stringify(t, (n, a) => typeof a == "bigint" ? a.toString() : a)})` : e;
}
function gu(e) {
  const t = e.error, n = e.command != null ? Number(e.command) : void 0;
  switch (t.$kind) {
    case "MoveAbort": {
      const [a, s] = t.MoveAbort, r = {
        package: a.module.address,
        module: a.module.name,
        function: a.function,
        functionName: a.functionName ?? void 0,
        instruction: a.instruction
      };
      return {
        $kind: "MoveAbort",
        message: Ao({
          command: n,
          location: r,
          abortCode: String(s)
        }),
        command: n,
        MoveAbort: {
          abortCode: String(s),
          location: r
        }
      };
    }
    case "MoveObjectTooBig":
      return {
        $kind: "SizeError",
        message: E0("MoveObjectTooBig", t.MoveObjectTooBig),
        command: n,
        SizeError: {
          name: "ObjectTooBig",
          size: Number(t.MoveObjectTooBig.objectSize),
          maxSize: Number(t.MoveObjectTooBig.maxObjectSize)
        }
      };
    case "MovePackageTooBig":
      return {
        $kind: "SizeError",
        message: E0("MovePackageTooBig", t.MovePackageTooBig),
        command: n,
        SizeError: {
          name: "PackageTooBig",
          size: Number(t.MovePackageTooBig.objectSize),
          maxSize: Number(t.MovePackageTooBig.maxObjectSize)
        }
      };
    case "EffectsTooLarge":
      return {
        $kind: "SizeError",
        message: E0("EffectsTooLarge", t.EffectsTooLarge),
        command: n,
        SizeError: {
          name: "EffectsTooLarge",
          size: Number(t.EffectsTooLarge.currentSize),
          maxSize: Number(t.EffectsTooLarge.maxSize)
        }
      };
    case "WrittenObjectsTooLarge":
      return {
        $kind: "SizeError",
        message: E0("WrittenObjectsTooLarge", t.WrittenObjectsTooLarge),
        command: n,
        SizeError: {
          name: "WrittenObjectsTooLarge",
          size: Number(t.WrittenObjectsTooLarge.currentSize),
          maxSize: Number(t.WrittenObjectsTooLarge.maxSize)
        }
      };
    case "MoveVectorElemTooBig":
      return {
        $kind: "SizeError",
        message: E0("MoveVectorElemTooBig", t.MoveVectorElemTooBig),
        command: n,
        SizeError: {
          name: "MoveVectorElemTooBig",
          size: Number(t.MoveVectorElemTooBig.valueSize),
          maxSize: Number(t.MoveVectorElemTooBig.maxScaledSize)
        }
      };
    case "MoveRawValueTooBig":
      return {
        $kind: "SizeError",
        message: E0("MoveRawValueTooBig", t.MoveRawValueTooBig),
        command: n,
        SizeError: {
          name: "MoveRawValueTooBig",
          size: Number(t.MoveRawValueTooBig.valueSize),
          maxSize: Number(t.MoveRawValueTooBig.maxScaledSize)
        }
      };
    case "CommandArgumentError":
      return {
        $kind: "CommandArgumentError",
        message: E0("CommandArgumentError", t.CommandArgumentError),
        command: n,
        CommandArgumentError: {
          argument: t.CommandArgumentError.argIdx,
          name: t.CommandArgumentError.kind.$kind
        }
      };
    case "TypeArgumentError":
      return {
        $kind: "TypeArgumentError",
        message: E0("TypeArgumentError", t.TypeArgumentError),
        command: n,
        TypeArgumentError: {
          typeArgument: t.TypeArgumentError.argumentIdx,
          name: t.TypeArgumentError.kind.$kind
        }
      };
    case "PackageUpgradeError": {
      const a = t.PackageUpgradeError.upgradeError;
      return {
        $kind: "PackageUpgradeError",
        message: E0("PackageUpgradeError", t.PackageUpgradeError),
        command: n,
        PackageUpgradeError: {
          name: a.$kind,
          packageId: a.$kind === "UnableToFetchPackage" ? a.UnableToFetchPackage.packageId : void 0,
          digest: a.$kind === "DigestDoesNotMatch" ? ya(a.DigestDoesNotMatch.digest) : void 0
        }
      };
    }
    case "ExecutionCancelledDueToSharedObjectCongestion":
      return {
        $kind: "CongestedObjects",
        message: E0("ExecutionCancelledDueToSharedObjectCongestion", t.ExecutionCancelledDueToSharedObjectCongestion),
        command: n,
        CongestedObjects: {
          name: "ExecutionCanceledDueToConsensusObjectCongestion",
          objects: t.ExecutionCancelledDueToSharedObjectCongestion.congested_objects
        }
      };
    case "AddressDeniedForCoin":
      return {
        $kind: "CoinDenyListError",
        message: E0("AddressDeniedForCoin", t.AddressDeniedForCoin),
        command: n,
        CoinDenyListError: {
          name: "AddressDeniedForCoin",
          address: t.AddressDeniedForCoin.address,
          coinType: t.AddressDeniedForCoin.coinType
        }
      };
    case "CoinTypeGlobalPause":
      return {
        $kind: "CoinDenyListError",
        message: E0("CoinTypeGlobalPause", t.CoinTypeGlobalPause),
        command: n,
        CoinDenyListError: {
          name: "CoinTypeGlobalPause",
          coinType: t.CoinTypeGlobalPause.coinType
        }
      };
    case "CircularObjectOwnership":
      return {
        $kind: "ObjectIdError",
        message: E0("CircularObjectOwnership", t.CircularObjectOwnership),
        command: n,
        ObjectIdError: {
          name: "CircularObjectOwnership",
          objectId: t.CircularObjectOwnership.object
        }
      };
    case "InvalidGasObject":
      return {
        $kind: "ObjectIdError",
        message: "InvalidGasObject",
        command: n,
        ObjectIdError: {
          name: "InvalidGasObject",
          objectId: ""
        }
      };
    case "InputObjectDeleted":
      return {
        $kind: "ObjectIdError",
        message: "InputObjectDeleted",
        command: n,
        ObjectIdError: {
          name: "InputObjectDeleted",
          objectId: ""
        }
      };
    case "InvalidTransferObject":
      return {
        $kind: "ObjectIdError",
        message: "InvalidTransferObject",
        command: n,
        ObjectIdError: {
          name: "InvalidTransferObject",
          objectId: ""
        }
      };
    case "NonExclusiveWriteInputObjectModified":
      return {
        $kind: "Unknown",
        message: E0("NonExclusiveWriteInputObjectModified", t.NonExclusiveWriteInputObjectModified),
        command: n,
        Unknown: null
      };
    case "InsufficientGas":
    case "InvariantViolation":
    case "FeatureNotYetSupported":
    case "InsufficientCoinBalance":
    case "CoinBalanceOverflow":
    case "PublishErrorNonZeroAddress":
    case "SuiMoveVerificationError":
    case "MovePrimitiveRuntimeError":
    case "VMVerificationOrDeserializationError":
    case "VMInvariantViolation":
    case "FunctionNotFound":
    case "ArityMismatch":
    case "TypeArityMismatch":
    case "NonEntryFunctionInvoked":
    case "UnusedValueWithoutDrop":
    case "InvalidPublicFunctionReturnType":
    case "PublishUpgradeMissingDependency":
    case "PublishUpgradeDependencyDowngrade":
    case "CertificateDenied":
    case "SuiMoveVerificationTimedout":
    case "SharedObjectOperationNotAllowed":
    case "ExecutionCancelledDueToRandomnessUnavailable":
    case "InvalidLinkage":
    case "InsufficientBalanceForWithdraw":
      return {
        $kind: "Unknown",
        message: t.$kind,
        command: n,
        Unknown: null
      };
    default:
      return {
        $kind: "Unknown",
        message: "Unknown error",
        command: n,
        Unknown: null
      };
  }
}
function hu(e) {
  try {
    return h.TransactionData.parse(e).V1?.gasData.payment?.length === 0;
  } catch {
    return !1;
  }
}
function Au(e) {
  const t = h.TransactionEffects.parse(e);
  switch (t.$kind) {
    case "V1":
      return yu({
        effects: t.V1
      });
    case "V2":
      return wu({
        bytes: e,
        effects: t.V2
      });
    default:
      throw new Error(`Unknown transaction effects version: ${t.$kind}`);
  }
}
function yu(e) {
  throw new Error("V1 effects are not supported yet");
}
function wu({ bytes: e, effects: t }) {
  const n = t.changedObjects.map(([a, s]) => ({
    objectId: a,
    inputState: s.inputState.$kind === "Exist" ? "Exists" : "DoesNotExist",
    inputVersion: s.inputState.Exist?.[0][0] ?? null,
    inputDigest: s.inputState.Exist?.[0][1] ?? null,
    inputOwner: s.inputState.Exist?.[1] ?? null,
    outputState: s.outputState.$kind === "NotExist" ? "DoesNotExist" : s.outputState.$kind,
    outputVersion: s.outputState.$kind === "PackageWrite" ? s.outputState.PackageWrite?.[0] : s.outputState.$kind === "ObjectWrite" ? t.lamportVersion : null,
    outputDigest: s.outputState.$kind === "PackageWrite" ? s.outputState.PackageWrite?.[1] : s.outputState.$kind === "ObjectWrite" ? s.outputState.ObjectWrite?.[0] ?? null : null,
    outputOwner: s.outputState.$kind === "ObjectWrite" ? s.outputState.ObjectWrite[1] : null,
    idOperation: s.idOperation.$kind
  }));
  return {
    bcs: e,
    version: 2,
    status: t.status.$kind === "Success" ? {
      success: !0,
      error: null
    } : {
      success: !1,
      error: gu(t.status.Failure)
    },
    gasUsed: t.gasUsed,
    transactionDigest: t.transactionDigest,
    gasObject: t.gasObjectIndex === null ? null : n[t.gasObjectIndex] ?? null,
    eventsDigest: t.eventsDigest,
    dependencies: t.dependencies,
    lamportVersion: t.lamportVersion,
    changedObjects: n,
    unchangedConsensusObjects: t.unchangedConsensusObjects.map(([a, s]) => ({
      kind: s.$kind,
      objectId: a,
      version: s.$kind === "ReadOnlyRoot" ? s.ReadOnlyRoot[0] : s[s.$kind],
      digest: s.$kind === "ReadOnlyRoot" ? s.ReadOnlyRoot[1] : null
    })),
    auxiliaryDataDigest: t.auxDataDigest
  };
}
function qe(e) {
  let t = typeof e;
  if (t == "object") {
    if (Array.isArray(e))
      return "array";
    if (e === null)
      return "null";
  }
  return t;
}
function yo(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e);
}
let pe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""), Bn = [];
for (let e = 0; e < pe.length; e++)
  Bn[pe[e].charCodeAt(0)] = e;
Bn[45] = pe.indexOf("+");
Bn[95] = pe.indexOf("/");
function vu(e) {
  let t = e.length * 3 / 4;
  e[e.length - 2] == "=" ? t -= 2 : e[e.length - 1] == "=" && (t -= 1);
  let n = new Uint8Array(t), a = 0, s = 0, r, i = 0;
  for (let o = 0; o < e.length; o++) {
    if (r = Bn[e.charCodeAt(o)], r === void 0)
      switch (e[o]) {
        case "=":
          s = 0;
        case `
`:
        case "\r":
        case "	":
        case " ":
          continue;
        default:
          throw Error("invalid base64 string.");
      }
    switch (s) {
      case 0:
        i = r, s = 1;
        break;
      case 1:
        n[a++] = i << 2 | (r & 48) >> 4, i = r, s = 2;
        break;
      case 2:
        n[a++] = (i & 15) << 4 | (r & 60) >> 2, i = r, s = 3;
        break;
      case 3:
        n[a++] = (i & 3) << 6 | r, s = 0;
        break;
    }
  }
  if (s == 1)
    throw Error("invalid base64 string.");
  return n.subarray(0, a);
}
function Tu(e) {
  let t = "", n = 0, a, s = 0;
  for (let r = 0; r < e.length; r++)
    switch (a = e[r], n) {
      case 0:
        t += pe[a >> 2], s = (a & 3) << 4, n = 1;
        break;
      case 1:
        t += pe[s | a >> 4], s = (a & 15) << 2, n = 2;
        break;
      case 2:
        t += pe[s | a >> 6], t += pe[a & 63], n = 0;
        break;
    }
  return n && (t += pe[s], t += "=", n == 1 && (t += "=")), t;
}
var gn;
(function(e) {
  e.symbol = Symbol.for("protobuf-ts/unknown"), e.onRead = (n, a, s, r, i) => {
    (t(a) ? a[e.symbol] : a[e.symbol] = []).push({ no: s, wireType: r, data: i });
  }, e.onWrite = (n, a, s) => {
    for (let { no: r, wireType: i, data: o } of e.list(a))
      s.tag(r, i).raw(o);
  }, e.list = (n, a) => {
    if (t(n)) {
      let s = n[e.symbol];
      return a ? s.filter((r) => r.no == a) : s;
    }
    return [];
  }, e.last = (n, a) => e.list(n, a).slice(-1)[0];
  const t = (n) => n && Array.isArray(n[e.symbol]);
})(gn || (gn = {}));
var d0;
(function(e) {
  e[e.Varint = 0] = "Varint", e[e.Bit64 = 1] = "Bit64", e[e.LengthDelimited = 2] = "LengthDelimited", e[e.StartGroup = 3] = "StartGroup", e[e.EndGroup = 4] = "EndGroup", e[e.Bit32 = 5] = "Bit32";
})(d0 || (d0 = {}));
function Iu() {
  let e = 0, t = 0;
  for (let a = 0; a < 28; a += 7) {
    let s = this.buf[this.pos++];
    if (e |= (s & 127) << a, !(s & 128))
      return this.assertBounds(), [e, t];
  }
  let n = this.buf[this.pos++];
  if (e |= (n & 15) << 28, t = (n & 112) >> 4, !(n & 128))
    return this.assertBounds(), [e, t];
  for (let a = 3; a <= 31; a += 7) {
    let s = this.buf[this.pos++];
    if (t |= (s & 127) << a, !(s & 128))
      return this.assertBounds(), [e, t];
  }
  throw new Error("invalid varint");
}
function Hn(e, t, n) {
  for (let r = 0; r < 28; r = r + 7) {
    const i = e >>> r, o = !(!(i >>> 7) && t == 0), c = (o ? i | 128 : i) & 255;
    if (n.push(c), !o)
      return;
  }
  const a = e >>> 28 & 15 | (t & 7) << 4, s = !!(t >> 3);
  if (n.push((s ? a | 128 : a) & 255), !!s) {
    for (let r = 3; r < 31; r = r + 7) {
      const i = t >>> r, o = !!(i >>> 7), c = (o ? i | 128 : i) & 255;
      if (n.push(c), !o)
        return;
    }
    n.push(t >>> 31 & 1);
  }
}
const nn = 65536 * 65536;
function wo(e) {
  let t = e[0] == "-";
  t && (e = e.slice(1));
  const n = 1e6;
  let a = 0, s = 0;
  function r(i, o) {
    const c = Number(e.slice(i, o));
    s *= n, a = a * n + c, a >= nn && (s = s + (a / nn | 0), a = a % nn);
  }
  return r(-24, -18), r(-18, -12), r(-12, -6), r(-6), [t, a, s];
}
function va(e, t) {
  if (t >>> 0 <= 2097151)
    return "" + (nn * t + (e >>> 0));
  let n = e & 16777215, a = (e >>> 24 | t << 8) >>> 0 & 16777215, s = t >> 16 & 65535, r = n + a * 6777216 + s * 6710656, i = a + s * 8147497, o = s * 2, c = 1e7;
  r >= c && (i += Math.floor(r / c), r %= c), i >= c && (o += Math.floor(i / c), i %= c);
  function u(f, l) {
    let b = f ? String(f) : "";
    return l ? "0000000".slice(b.length) + b : b;
  }
  return u(
    o,
    /*needLeadingZeros=*/
    0
  ) + u(
    i,
    /*needLeadingZeros=*/
    o
  ) + // If the final 1e7 digit didn't need leading zeros, we would have
  // returned via the trivial code path at the top.
  u(
    r,
    /*needLeadingZeros=*/
    1
  );
}
function Ls(e, t) {
  if (e >= 0) {
    for (; e > 127; )
      t.push(e & 127 | 128), e = e >>> 7;
    t.push(e);
  } else {
    for (let n = 0; n < 9; n++)
      t.push(e & 127 | 128), e = e >> 7;
    t.push(1);
  }
}
function Ou() {
  let e = this.buf[this.pos++], t = e & 127;
  if (!(e & 128))
    return this.assertBounds(), t;
  if (e = this.buf[this.pos++], t |= (e & 127) << 7, !(e & 128))
    return this.assertBounds(), t;
  if (e = this.buf[this.pos++], t |= (e & 127) << 14, !(e & 128))
    return this.assertBounds(), t;
  if (e = this.buf[this.pos++], t |= (e & 127) << 21, !(e & 128))
    return this.assertBounds(), t;
  e = this.buf[this.pos++], t |= (e & 15) << 28;
  for (let n = 5; e & 128 && n < 10; n++)
    e = this.buf[this.pos++];
  if (e & 128)
    throw new Error("invalid varint");
  return this.assertBounds(), t >>> 0;
}
let J;
function Eu() {
  const e = new DataView(new ArrayBuffer(8));
  J = globalThis.BigInt !== void 0 && typeof e.getBigInt64 == "function" && typeof e.getBigUint64 == "function" && typeof e.setBigInt64 == "function" && typeof e.setBigUint64 == "function" ? {
    MIN: BigInt("-9223372036854775808"),
    MAX: BigInt("9223372036854775807"),
    UMIN: BigInt("0"),
    UMAX: BigInt("18446744073709551615"),
    C: BigInt,
    V: e
  } : void 0;
}
Eu();
function vo(e) {
  if (!e)
    throw new Error("BigInt unavailable, see https://github.com/timostamm/protobuf-ts/blob/v1.0.8/MANUAL.md#bigint-support");
}
const To = /^-?[0-9]+$/, hn = 4294967296, zt = 2147483648;
class Io {
  /**
   * Create a new instance with the given bits.
   */
  constructor(t, n) {
    this.lo = t | 0, this.hi = n | 0;
  }
  /**
   * Is this instance equal to 0?
   */
  isZero() {
    return this.lo == 0 && this.hi == 0;
  }
  /**
   * Convert to a native number.
   */
  toNumber() {
    let t = this.hi * hn + (this.lo >>> 0);
    if (!Number.isSafeInteger(t))
      throw new Error("cannot convert to safe number");
    return t;
  }
}
class y0 extends Io {
  /**
   * Create instance from a `string`, `number` or `bigint`.
   */
  static from(t) {
    if (J)
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t == "")
            throw new Error("string is no integer");
          t = J.C(t);
        case "number":
          if (t === 0)
            return this.ZERO;
          t = J.C(t);
        case "bigint":
          if (!t)
            return this.ZERO;
          if (t < J.UMIN)
            throw new Error("signed value for ulong");
          if (t > J.UMAX)
            throw new Error("ulong too large");
          return J.V.setBigUint64(0, t, !0), new y0(J.V.getInt32(0, !0), J.V.getInt32(4, !0));
      }
    else
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t = t.trim(), !To.test(t))
            throw new Error("string is no integer");
          let [n, a, s] = wo(t);
          if (n)
            throw new Error("signed value for ulong");
          return new y0(a, s);
        case "number":
          if (t == 0)
            return this.ZERO;
          if (!Number.isSafeInteger(t))
            throw new Error("number is no integer");
          if (t < 0)
            throw new Error("signed value for ulong");
          return new y0(t, t / hn);
      }
    throw new Error("unknown value " + typeof t);
  }
  /**
   * Convert to decimal string.
   */
  toString() {
    return J ? this.toBigInt().toString() : va(this.lo, this.hi);
  }
  /**
   * Convert to native bigint.
   */
  toBigInt() {
    return vo(J), J.V.setInt32(0, this.lo, !0), J.V.setInt32(4, this.hi, !0), J.V.getBigUint64(0, !0);
  }
}
y0.ZERO = new y0(0, 0);
class G extends Io {
  /**
   * Create instance from a `string`, `number` or `bigint`.
   */
  static from(t) {
    if (J)
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t == "")
            throw new Error("string is no integer");
          t = J.C(t);
        case "number":
          if (t === 0)
            return this.ZERO;
          t = J.C(t);
        case "bigint":
          if (!t)
            return this.ZERO;
          if (t < J.MIN)
            throw new Error("signed long too small");
          if (t > J.MAX)
            throw new Error("signed long too large");
          return J.V.setBigInt64(0, t, !0), new G(J.V.getInt32(0, !0), J.V.getInt32(4, !0));
      }
    else
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t = t.trim(), !To.test(t))
            throw new Error("string is no integer");
          let [n, a, s] = wo(t);
          if (n) {
            if (s > zt || s == zt && a != 0)
              throw new Error("signed long too small");
          } else if (s >= zt)
            throw new Error("signed long too large");
          let r = new G(a, s);
          return n ? r.negate() : r;
        case "number":
          if (t == 0)
            return this.ZERO;
          if (!Number.isSafeInteger(t))
            throw new Error("number is no integer");
          return t > 0 ? new G(t, t / hn) : new G(-t, -t / hn).negate();
      }
    throw new Error("unknown value " + typeof t);
  }
  /**
   * Do we have a minus sign?
   */
  isNegative() {
    return (this.hi & zt) !== 0;
  }
  /**
   * Negate two's complement.
   * Invert all the bits and add one to the result.
   */
  negate() {
    let t = ~this.hi, n = this.lo;
    return n ? n = ~n + 1 : t += 1, new G(n, t);
  }
  /**
   * Convert to decimal string.
   */
  toString() {
    if (J)
      return this.toBigInt().toString();
    if (this.isNegative()) {
      let t = this.negate();
      return "-" + va(t.lo, t.hi);
    }
    return va(this.lo, this.hi);
  }
  /**
   * Convert to native bigint.
   */
  toBigInt() {
    return vo(J), J.V.setInt32(0, this.lo, !0), J.V.setInt32(4, this.hi, !0), J.V.getBigInt64(0, !0);
  }
}
G.ZERO = new G(0, 0);
const zs = {
  readUnknownField: !0,
  readerFactory: (e) => new ku(e)
};
function Su(e) {
  return e ? Object.assign(Object.assign({}, zs), e) : zs;
}
class ku {
  constructor(t, n) {
    this.varint64 = Iu, this.uint32 = Ou, this.buf = t, this.len = t.length, this.pos = 0, this.view = new DataView(t.buffer, t.byteOffset, t.byteLength), this.textDecoder = n ?? new TextDecoder("utf-8", {
      fatal: !0,
      ignoreBOM: !0
    });
  }
  /**
   * Reads a tag - field number and wire type.
   */
  tag() {
    let t = this.uint32(), n = t >>> 3, a = t & 7;
    if (n <= 0 || a < 0 || a > 5)
      throw new Error("illegal tag: field no " + n + " wire type " + a);
    return [n, a];
  }
  /**
   * Skip one element on the wire and return the skipped data.
   * Supports WireType.StartGroup since v2.0.0-alpha.23.
   */
  skip(t) {
    let n = this.pos;
    switch (t) {
      case d0.Varint:
        for (; this.buf[this.pos++] & 128; )
          ;
        break;
      case d0.Bit64:
        this.pos += 4;
      case d0.Bit32:
        this.pos += 4;
        break;
      case d0.LengthDelimited:
        let a = this.uint32();
        this.pos += a;
        break;
      case d0.StartGroup:
        let s;
        for (; (s = this.tag()[1]) !== d0.EndGroup; )
          this.skip(s);
        break;
      default:
        throw new Error("cant skip wire type " + t);
    }
    return this.assertBounds(), this.buf.subarray(n, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let t = this.uint32();
    return t >>> 1 ^ -(t & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    return new G(...this.varint64());
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    return new y0(...this.varint64());
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    let [t, n] = this.varint64(), a = -(t & 1);
    return t = (t >>> 1 | (n & 1) << 31) ^ a, n = n >>> 1 ^ a, new G(t, n);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    let [t, n] = this.varint64();
    return t !== 0 || n !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return new y0(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return new G(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, !0);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let t = this.uint32(), n = this.pos;
    return this.pos += t, this.assertBounds(), this.buf.subarray(n, n + t);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text.
   */
  string() {
    return this.textDecoder.decode(this.bytes());
  }
}
function V(e, t) {
  if (!e)
    throw new Error(t);
}
const Nu = 34028234663852886e22, Cu = -34028234663852886e22, xu = 4294967295, _u = 2147483647, Bu = -2147483648;
function wt(e) {
  if (typeof e != "number")
    throw new Error("invalid int 32: " + typeof e);
  if (!Number.isInteger(e) || e > _u || e < Bu)
    throw new Error("invalid int 32: " + e);
}
function An(e) {
  if (typeof e != "number")
    throw new Error("invalid uint 32: " + typeof e);
  if (!Number.isInteger(e) || e > xu || e < 0)
    throw new Error("invalid uint 32: " + e);
}
function Qa(e) {
  if (typeof e != "number")
    throw new Error("invalid float 32: " + typeof e);
  if (Number.isFinite(e) && (e > Nu || e < Cu))
    throw new Error("invalid float 32: " + e);
}
const Gs = {
  writeUnknownFields: !0,
  writerFactory: () => new Mu()
};
function ju(e) {
  return e ? Object.assign(Object.assign({}, Gs), e) : Gs;
}
class Mu {
  constructor(t) {
    this.stack = [], this.textEncoder = t ?? new TextEncoder(), this.chunks = [], this.buf = [];
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    this.chunks.push(new Uint8Array(this.buf));
    let t = 0;
    for (let s = 0; s < this.chunks.length; s++)
      t += this.chunks[s].length;
    let n = new Uint8Array(t), a = 0;
    for (let s = 0; s < this.chunks.length; s++)
      n.set(this.chunks[s], a), a += this.chunks[s].length;
    return this.chunks = [], n;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    return this.stack.push({ chunks: this.chunks, buf: this.buf }), this.chunks = [], this.buf = [], this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    let t = this.finish(), n = this.stack.pop();
    if (!n)
      throw new Error("invalid state, fork stack empty");
    return this.chunks = n.chunks, this.buf = n.buf, this.uint32(t.byteLength), this.raw(t);
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(t, n) {
    return this.uint32((t << 3 | n) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(t) {
    return this.buf.length && (this.chunks.push(new Uint8Array(this.buf)), this.buf = []), this.chunks.push(t), this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(t) {
    for (An(t); t > 127; )
      this.buf.push(t & 127 | 128), t = t >>> 7;
    return this.buf.push(t), this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(t) {
    return wt(t), Ls(t, this.buf), this;
  }
  /**
   * Write a `bool` value, a variant.
   */
  bool(t) {
    return this.buf.push(t ? 1 : 0), this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(t) {
    return this.uint32(t.byteLength), this.raw(t);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(t) {
    let n = this.textEncoder.encode(t);
    return this.uint32(n.byteLength), this.raw(n);
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(t) {
    Qa(t);
    let n = new Uint8Array(4);
    return new DataView(n.buffer).setFloat32(0, t, !0), this.raw(n);
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(t) {
    let n = new Uint8Array(8);
    return new DataView(n.buffer).setFloat64(0, t, !0), this.raw(n);
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(t) {
    An(t);
    let n = new Uint8Array(4);
    return new DataView(n.buffer).setUint32(0, t, !0), this.raw(n);
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(t) {
    wt(t);
    let n = new Uint8Array(4);
    return new DataView(n.buffer).setInt32(0, t, !0), this.raw(n);
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(t) {
    return wt(t), t = (t << 1 ^ t >> 31) >>> 0, Ls(t, this.buf), this;
  }
  /**
   * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(t) {
    let n = new Uint8Array(8), a = new DataView(n.buffer), s = G.from(t);
    return a.setInt32(0, s.lo, !0), a.setInt32(4, s.hi, !0), this.raw(n);
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(t) {
    let n = new Uint8Array(8), a = new DataView(n.buffer), s = y0.from(t);
    return a.setInt32(0, s.lo, !0), a.setInt32(4, s.hi, !0), this.raw(n);
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(t) {
    let n = G.from(t);
    return Hn(n.lo, n.hi, this.buf), this;
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(t) {
    let n = G.from(t), a = n.hi >> 31, s = n.lo << 1 ^ a, r = (n.hi << 1 | n.lo >>> 31) ^ a;
    return Hn(s, r, this.buf), this;
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(t) {
    let n = y0.from(t);
    return Hn(n.lo, n.hi, this.buf), this;
  }
}
const Ws = {
  emitDefaultValues: !1,
  enumAsInteger: !1,
  useProtoFieldName: !1,
  prettySpaces: 0
}, Qs = {
  ignoreUnknownFields: !1
};
function Ru(e) {
  return e ? Object.assign(Object.assign({}, Qs), e) : Qs;
}
function Du(e) {
  return e ? Object.assign(Object.assign({}, Ws), e) : Ws;
}
const Oo = Symbol.for("protobuf-ts/message-type");
function Js(e) {
  let t = !1;
  const n = [];
  for (let a = 0; a < e.length; a++) {
    let s = e.charAt(a);
    s == "_" ? t = !0 : /\d/.test(s) ? (n.push(s), t = !0) : t ? (n.push(s.toUpperCase()), t = !1) : a == 0 ? n.push(s.toLowerCase()) : n.push(s);
  }
  return n.join("");
}
var A;
(function(e) {
  e[e.DOUBLE = 1] = "DOUBLE", e[e.FLOAT = 2] = "FLOAT", e[e.INT64 = 3] = "INT64", e[e.UINT64 = 4] = "UINT64", e[e.INT32 = 5] = "INT32", e[e.FIXED64 = 6] = "FIXED64", e[e.FIXED32 = 7] = "FIXED32", e[e.BOOL = 8] = "BOOL", e[e.STRING = 9] = "STRING", e[e.BYTES = 12] = "BYTES", e[e.UINT32 = 13] = "UINT32", e[e.SFIXED32 = 15] = "SFIXED32", e[e.SFIXED64 = 16] = "SFIXED64", e[e.SINT32 = 17] = "SINT32", e[e.SINT64 = 18] = "SINT64";
})(A || (A = {}));
var te;
(function(e) {
  e[e.BIGINT = 0] = "BIGINT", e[e.STRING = 1] = "STRING", e[e.NUMBER = 2] = "NUMBER";
})(te || (te = {}));
var yn;
(function(e) {
  e[e.NO = 0] = "NO", e[e.PACKED = 1] = "PACKED", e[e.UNPACKED = 2] = "UNPACKED";
})(yn || (yn = {}));
function Uu(e) {
  var t, n, a, s;
  return e.localName = (t = e.localName) !== null && t !== void 0 ? t : Js(e.name), e.jsonName = (n = e.jsonName) !== null && n !== void 0 ? n : Js(e.name), e.repeat = (a = e.repeat) !== null && a !== void 0 ? a : yn.NO, e.opt = (s = e.opt) !== null && s !== void 0 ? s : e.repeat || e.oneof ? !1 : e.kind == "message", e;
}
function Pu(e) {
  if (typeof e != "object" || e === null || !e.hasOwnProperty("oneofKind"))
    return !1;
  switch (typeof e.oneofKind) {
    case "string":
      return e[e.oneofKind] === void 0 ? !1 : Object.keys(e).length == 2;
    case "undefined":
      return Object.keys(e).length == 1;
    default:
      return !1;
  }
}
class Vu {
  constructor(t) {
    var n;
    this.fields = (n = t.fields) !== null && n !== void 0 ? n : [];
  }
  prepare() {
    if (this.data)
      return;
    const t = [], n = [], a = [];
    for (let s of this.fields)
      if (s.oneof)
        a.includes(s.oneof) || (a.push(s.oneof), t.push(s.oneof), n.push(s.oneof));
      else
        switch (n.push(s.localName), s.kind) {
          case "scalar":
          case "enum":
            (!s.opt || s.repeat) && t.push(s.localName);
            break;
          case "message":
            s.repeat && t.push(s.localName);
            break;
          case "map":
            t.push(s.localName);
            break;
        }
    this.data = { req: t, known: n, oneofs: Object.values(a) };
  }
  /**
   * Is the argument a valid message as specified by the
   * reflection information?
   *
   * Checks all field types recursively. The `depth`
   * specifies how deep into the structure the check will be.
   *
   * With a depth of 0, only the presence of fields
   * is checked.
   *
   * With a depth of 1 or more, the field types are checked.
   *
   * With a depth of 2 or more, the members of map, repeated
   * and message fields are checked.
   *
   * Message fields will be checked recursively with depth - 1.
   *
   * The number of map entries / repeated values being checked
   * is < depth.
   */
  is(t, n, a = !1) {
    if (n < 0)
      return !0;
    if (t == null || typeof t != "object")
      return !1;
    this.prepare();
    let s = Object.keys(t), r = this.data;
    if (s.length < r.req.length || r.req.some((i) => !s.includes(i)) || !a && s.some((i) => !r.known.includes(i)))
      return !1;
    if (n < 1)
      return !0;
    for (const i of r.oneofs) {
      const o = t[i];
      if (!Pu(o))
        return !1;
      if (o.oneofKind === void 0)
        continue;
      const c = this.fields.find((u) => u.localName === o.oneofKind);
      if (!c || !this.field(o[o.oneofKind], c, a, n))
        return !1;
    }
    for (const i of this.fields)
      if (i.oneof === void 0 && !this.field(t[i.localName], i, a, n))
        return !1;
    return !0;
  }
  field(t, n, a, s) {
    let r = n.repeat;
    switch (n.kind) {
      case "scalar":
        return t === void 0 ? n.opt : r ? this.scalars(t, n.T, s, n.L) : this.scalar(t, n.T, n.L);
      case "enum":
        return t === void 0 ? n.opt : r ? this.scalars(t, A.INT32, s) : this.scalar(t, A.INT32);
      case "message":
        return t === void 0 ? !0 : r ? this.messages(t, n.T(), a, s) : this.message(t, n.T(), a, s);
      case "map":
        if (typeof t != "object" || t === null)
          return !1;
        if (s < 2)
          return !0;
        if (!this.mapKeys(t, n.K, s))
          return !1;
        switch (n.V.kind) {
          case "scalar":
            return this.scalars(Object.values(t), n.V.T, s, n.V.L);
          case "enum":
            return this.scalars(Object.values(t), A.INT32, s);
          case "message":
            return this.messages(Object.values(t), n.V.T(), a, s);
        }
        break;
    }
    return !0;
  }
  message(t, n, a, s) {
    return a ? n.isAssignable(t, s) : n.is(t, s);
  }
  messages(t, n, a, s) {
    if (!Array.isArray(t))
      return !1;
    if (s < 2)
      return !0;
    if (a) {
      for (let r = 0; r < t.length && r < s; r++)
        if (!n.isAssignable(t[r], s - 1))
          return !1;
    } else
      for (let r = 0; r < t.length && r < s; r++)
        if (!n.is(t[r], s - 1))
          return !1;
    return !0;
  }
  scalar(t, n, a) {
    let s = typeof t;
    switch (n) {
      case A.UINT64:
      case A.FIXED64:
      case A.INT64:
      case A.SFIXED64:
      case A.SINT64:
        switch (a) {
          case te.BIGINT:
            return s == "bigint";
          case te.NUMBER:
            return s == "number" && !isNaN(t);
          default:
            return s == "string";
        }
      case A.BOOL:
        return s == "boolean";
      case A.STRING:
        return s == "string";
      case A.BYTES:
        return t instanceof Uint8Array;
      case A.DOUBLE:
      case A.FLOAT:
        return s == "number" && !isNaN(t);
      default:
        return s == "number" && Number.isInteger(t);
    }
  }
  scalars(t, n, a, s) {
    if (!Array.isArray(t))
      return !1;
    if (a < 2)
      return !0;
    if (Array.isArray(t)) {
      for (let r = 0; r < t.length && r < a; r++)
        if (!this.scalar(t[r], n, s))
          return !1;
    }
    return !0;
  }
  mapKeys(t, n, a) {
    let s = Object.keys(t);
    switch (n) {
      case A.INT32:
      case A.FIXED32:
      case A.SFIXED32:
      case A.SINT32:
      case A.UINT32:
        return this.scalars(s.slice(0, a).map((r) => parseInt(r)), n, a);
      case A.BOOL:
        return this.scalars(s.slice(0, a).map((r) => r == "true" ? !0 : r == "false" ? !1 : r), n, a);
      default:
        return this.scalars(s, n, a, te.STRING);
    }
  }
}
function Q0(e, t) {
  switch (t) {
    case te.BIGINT:
      return e.toBigInt();
    case te.NUMBER:
      return e.toNumber();
    default:
      return e.toString();
  }
}
class Fu {
  constructor(t) {
    this.info = t;
  }
  prepare() {
    var t;
    if (this.fMap === void 0) {
      this.fMap = {};
      const n = (t = this.info.fields) !== null && t !== void 0 ? t : [];
      for (const a of n)
        this.fMap[a.name] = a, this.fMap[a.jsonName] = a, this.fMap[a.localName] = a;
    }
  }
  // Cannot parse JSON <type of jsonValue> for <type name>#<fieldName>.
  assert(t, n, a) {
    if (!t) {
      let s = qe(a);
      throw (s == "number" || s == "boolean") && (s = a.toString()), new Error(`Cannot parse JSON ${s} for ${this.info.typeName}#${n}`);
    }
  }
  /**
   * Reads a message from canonical JSON format into the target message.
   *
   * Repeated fields are appended. Map entries are added, overwriting
   * existing keys.
   *
   * If a message field is already present, it will be merged with the
   * new data.
   */
  read(t, n, a) {
    this.prepare();
    const s = [];
    for (const [r, i] of Object.entries(t)) {
      const o = this.fMap[r];
      if (!o) {
        if (!a.ignoreUnknownFields)
          throw new Error(`Found unknown field while reading ${this.info.typeName} from JSON format. JSON key: ${r}`);
        continue;
      }
      const c = o.localName;
      let u;
      if (o.oneof) {
        if (i === null && (o.kind !== "enum" || o.T()[0] !== "google.protobuf.NullValue"))
          continue;
        if (s.includes(o.oneof))
          throw new Error(`Multiple members of the oneof group "${o.oneof}" of ${this.info.typeName} are present in JSON.`);
        s.push(o.oneof), u = n[o.oneof] = {
          oneofKind: c
        };
      } else
        u = n;
      if (o.kind == "map") {
        if (i === null)
          continue;
        this.assert(yo(i), o.name, i);
        const f = u[c];
        for (const [l, b] of Object.entries(i)) {
          this.assert(b !== null, o.name + " map value", null);
          let g;
          switch (o.V.kind) {
            case "message":
              g = o.V.T().internalJsonRead(b, a);
              break;
            case "enum":
              if (g = this.enum(o.V.T(), b, o.name, a.ignoreUnknownFields), g === !1)
                continue;
              break;
            case "scalar":
              g = this.scalar(b, o.V.T, o.V.L, o.name);
              break;
          }
          this.assert(g !== void 0, o.name + " map value", b);
          let m = l;
          o.K == A.BOOL && (m = m == "true" ? !0 : m == "false" ? !1 : m), m = this.scalar(m, o.K, te.STRING, o.name).toString(), f[m] = g;
        }
      } else if (o.repeat) {
        if (i === null)
          continue;
        this.assert(Array.isArray(i), o.name, i);
        const f = u[c];
        for (const l of i) {
          this.assert(l !== null, o.name, null);
          let b;
          switch (o.kind) {
            case "message":
              b = o.T().internalJsonRead(l, a);
              break;
            case "enum":
              if (b = this.enum(o.T(), l, o.name, a.ignoreUnknownFields), b === !1)
                continue;
              break;
            case "scalar":
              b = this.scalar(l, o.T, o.L, o.name);
              break;
          }
          this.assert(b !== void 0, o.name, i), f.push(b);
        }
      } else
        switch (o.kind) {
          case "message":
            if (i === null && o.T().typeName != "google.protobuf.Value") {
              this.assert(o.oneof === void 0, o.name + " (oneof member)", null);
              continue;
            }
            u[c] = o.T().internalJsonRead(i, a, u[c]);
            break;
          case "enum":
            if (i === null)
              continue;
            let f = this.enum(o.T(), i, o.name, a.ignoreUnknownFields);
            if (f === !1)
              continue;
            u[c] = f;
            break;
          case "scalar":
            if (i === null)
              continue;
            u[c] = this.scalar(i, o.T, o.L, o.name);
            break;
        }
    }
  }
  /**
   * Returns `false` for unrecognized string representations.
   *
   * google.protobuf.NullValue accepts only JSON `null` (or the old `"NULL_VALUE"`).
   */
  enum(t, n, a, s) {
    if (t[0] == "google.protobuf.NullValue" && V(n === null || n === "NULL_VALUE", `Unable to parse field ${this.info.typeName}#${a}, enum ${t[0]} only accepts null.`), n === null)
      return 0;
    switch (typeof n) {
      case "number":
        return V(Number.isInteger(n), `Unable to parse field ${this.info.typeName}#${a}, enum can only be integral number, got ${n}.`), n;
      case "string":
        let r = n;
        t[2] && n.substring(0, t[2].length) === t[2] && (r = n.substring(t[2].length));
        let i = t[1][r];
        return typeof i > "u" && s ? !1 : (V(typeof i == "number", `Unable to parse field ${this.info.typeName}#${a}, enum ${t[0]} has no value for "${n}".`), i);
    }
    V(!1, `Unable to parse field ${this.info.typeName}#${a}, cannot parse enum value from ${typeof n}".`);
  }
  scalar(t, n, a, s) {
    let r;
    try {
      switch (n) {
        case A.DOUBLE:
        case A.FLOAT:
          if (t === null)
            return 0;
          if (t === "NaN")
            return Number.NaN;
          if (t === "Infinity")
            return Number.POSITIVE_INFINITY;
          if (t === "-Infinity")
            return Number.NEGATIVE_INFINITY;
          if (t === "") {
            r = "empty string";
            break;
          }
          if (typeof t == "string" && t.trim().length !== t.length) {
            r = "extra whitespace";
            break;
          }
          if (typeof t != "string" && typeof t != "number")
            break;
          let i = Number(t);
          if (Number.isNaN(i)) {
            r = "not a number";
            break;
          }
          if (!Number.isFinite(i)) {
            r = "too large or small";
            break;
          }
          return n == A.FLOAT && Qa(i), i;
        case A.INT32:
        case A.FIXED32:
        case A.SFIXED32:
        case A.SINT32:
        case A.UINT32:
          if (t === null)
            return 0;
          let o;
          if (typeof t == "number" ? o = t : t === "" ? r = "empty string" : typeof t == "string" && (t.trim().length !== t.length ? r = "extra whitespace" : o = Number(t)), o === void 0)
            break;
          return n == A.UINT32 ? An(o) : wt(o), o;
        case A.INT64:
        case A.SFIXED64:
        case A.SINT64:
          if (t === null)
            return Q0(G.ZERO, a);
          if (typeof t != "number" && typeof t != "string")
            break;
          return Q0(G.from(t), a);
        case A.FIXED64:
        case A.UINT64:
          if (t === null)
            return Q0(y0.ZERO, a);
          if (typeof t != "number" && typeof t != "string")
            break;
          return Q0(y0.from(t), a);
        case A.BOOL:
          if (t === null)
            return !1;
          if (typeof t != "boolean")
            break;
          return t;
        case A.STRING:
          if (t === null)
            return "";
          if (typeof t != "string") {
            r = "extra whitespace";
            break;
          }
          try {
            encodeURIComponent(t);
          } catch (c) {
            c = "invalid UTF8";
            break;
          }
          return t;
        case A.BYTES:
          if (t === null || t === "")
            return new Uint8Array(0);
          if (typeof t != "string")
            break;
          return vu(t);
      }
    } catch (i) {
      r = i.message;
    }
    this.assert(!1, s + (r ? " - " + r : ""), t);
  }
}
class $u {
  constructor(t) {
    var n;
    this.fields = (n = t.fields) !== null && n !== void 0 ? n : [];
  }
  /**
   * Converts the message to a JSON object, based on the field descriptors.
   */
  write(t, n) {
    const a = {}, s = t;
    for (const r of this.fields) {
      if (!r.oneof) {
        let u = this.field(r, s[r.localName], n);
        u !== void 0 && (a[n.useProtoFieldName ? r.name : r.jsonName] = u);
        continue;
      }
      const i = s[r.oneof];
      if (i.oneofKind !== r.localName)
        continue;
      const o = r.kind == "scalar" || r.kind == "enum" ? Object.assign(Object.assign({}, n), { emitDefaultValues: !0 }) : n;
      let c = this.field(r, i[r.localName], o);
      V(c !== void 0), a[n.useProtoFieldName ? r.name : r.jsonName] = c;
    }
    return a;
  }
  field(t, n, a) {
    let s;
    if (t.kind == "map") {
      V(typeof n == "object" && n !== null);
      const r = {};
      switch (t.V.kind) {
        case "scalar":
          for (const [c, u] of Object.entries(n)) {
            const f = this.scalar(t.V.T, u, t.name, !1, !0);
            V(f !== void 0), r[c.toString()] = f;
          }
          break;
        case "message":
          const i = t.V.T();
          for (const [c, u] of Object.entries(n)) {
            const f = this.message(i, u, t.name, a);
            V(f !== void 0), r[c.toString()] = f;
          }
          break;
        case "enum":
          const o = t.V.T();
          for (const [c, u] of Object.entries(n)) {
            V(u === void 0 || typeof u == "number");
            const f = this.enum(o, u, t.name, !1, !0, a.enumAsInteger);
            V(f !== void 0), r[c.toString()] = f;
          }
          break;
      }
      (a.emitDefaultValues || Object.keys(r).length > 0) && (s = r);
    } else if (t.repeat) {
      V(Array.isArray(n));
      const r = [];
      switch (t.kind) {
        case "scalar":
          for (let c = 0; c < n.length; c++) {
            const u = this.scalar(t.T, n[c], t.name, t.opt, !0);
            V(u !== void 0), r.push(u);
          }
          break;
        case "enum":
          const i = t.T();
          for (let c = 0; c < n.length; c++) {
            V(n[c] === void 0 || typeof n[c] == "number");
            const u = this.enum(i, n[c], t.name, t.opt, !0, a.enumAsInteger);
            V(u !== void 0), r.push(u);
          }
          break;
        case "message":
          const o = t.T();
          for (let c = 0; c < n.length; c++) {
            const u = this.message(o, n[c], t.name, a);
            V(u !== void 0), r.push(u);
          }
          break;
      }
      (a.emitDefaultValues || r.length > 0 || a.emitDefaultValues) && (s = r);
    } else
      switch (t.kind) {
        case "scalar":
          s = this.scalar(t.T, n, t.name, t.opt, a.emitDefaultValues);
          break;
        case "enum":
          s = this.enum(t.T(), n, t.name, t.opt, a.emitDefaultValues, a.enumAsInteger);
          break;
        case "message":
          s = this.message(t.T(), n, t.name, a);
          break;
      }
    return s;
  }
  /**
   * Returns `null` as the default for google.protobuf.NullValue.
   */
  enum(t, n, a, s, r, i) {
    if (t[0] == "google.protobuf.NullValue")
      return !r && !s ? void 0 : null;
    if (n === void 0) {
      V(s);
      return;
    }
    if (!(n === 0 && !r && !s))
      return V(typeof n == "number"), V(Number.isInteger(n)), i || !t[1].hasOwnProperty(n) ? n : t[2] ? t[2] + t[1][n] : t[1][n];
  }
  message(t, n, a, s) {
    return n === void 0 ? s.emitDefaultValues ? null : void 0 : t.internalJsonWrite(n, s);
  }
  scalar(t, n, a, s, r) {
    if (n === void 0) {
      V(s);
      return;
    }
    const i = r || s;
    switch (t) {
      case A.INT32:
      case A.SFIXED32:
      case A.SINT32:
        return n === 0 ? i ? 0 : void 0 : (wt(n), n);
      case A.FIXED32:
      case A.UINT32:
        return n === 0 ? i ? 0 : void 0 : (An(n), n);
      case A.FLOAT:
        Qa(n);
      case A.DOUBLE:
        return n === 0 ? i ? 0 : void 0 : (V(typeof n == "number"), Number.isNaN(n) ? "NaN" : n === Number.POSITIVE_INFINITY ? "Infinity" : n === Number.NEGATIVE_INFINITY ? "-Infinity" : n);
      case A.STRING:
        return n === "" ? i ? "" : void 0 : (V(typeof n == "string"), n);
      case A.BOOL:
        return n === !1 ? i ? !1 : void 0 : (V(typeof n == "boolean"), n);
      case A.UINT64:
      case A.FIXED64:
        V(typeof n == "number" || typeof n == "string" || typeof n == "bigint");
        let o = y0.from(n);
        return o.isZero() && !i ? void 0 : o.toString();
      case A.INT64:
      case A.SFIXED64:
      case A.SINT64:
        V(typeof n == "number" || typeof n == "string" || typeof n == "bigint");
        let c = G.from(n);
        return c.isZero() && !i ? void 0 : c.toString();
      case A.BYTES:
        return V(n instanceof Uint8Array), n.byteLength ? Tu(n) : i ? "" : void 0;
    }
  }
}
function Ta(e, t = te.STRING) {
  switch (e) {
    case A.BOOL:
      return !1;
    case A.UINT64:
    case A.FIXED64:
      return Q0(y0.ZERO, t);
    case A.INT64:
    case A.SFIXED64:
    case A.SINT64:
      return Q0(G.ZERO, t);
    case A.DOUBLE:
    case A.FLOAT:
      return 0;
    case A.BYTES:
      return new Uint8Array(0);
    case A.STRING:
      return "";
    default:
      return 0;
  }
}
class Lu {
  constructor(t) {
    this.info = t;
  }
  prepare() {
    var t;
    if (!this.fieldNoToField) {
      const n = (t = this.info.fields) !== null && t !== void 0 ? t : [];
      this.fieldNoToField = new Map(n.map((a) => [a.no, a]));
    }
  }
  /**
   * Reads a message from binary format into the target message.
   *
   * Repeated fields are appended. Map entries are added, overwriting
   * existing keys.
   *
   * If a message field is already present, it will be merged with the
   * new data.
   */
  read(t, n, a, s) {
    this.prepare();
    const r = s === void 0 ? t.len : t.pos + s;
    for (; t.pos < r; ) {
      const [i, o] = t.tag(), c = this.fieldNoToField.get(i);
      if (!c) {
        let b = a.readUnknownField;
        if (b == "throw")
          throw new Error(`Unknown field ${i} (wire type ${o}) for ${this.info.typeName}`);
        let g = t.skip(o);
        b !== !1 && (b === !0 ? gn.onRead : b)(this.info.typeName, n, i, o, g);
        continue;
      }
      let u = n, f = c.repeat, l = c.localName;
      switch (c.oneof && (u = u[c.oneof], u.oneofKind !== l && (u = n[c.oneof] = {
        oneofKind: l
      })), c.kind) {
        case "scalar":
        case "enum":
          let b = c.kind == "enum" ? A.INT32 : c.T, g = c.kind == "scalar" ? c.L : void 0;
          if (f) {
            let y = u[l];
            if (o == d0.LengthDelimited && b != A.STRING && b != A.BYTES) {
              let E = t.uint32() + t.pos;
              for (; t.pos < E; )
                y.push(this.scalar(t, b, g));
            } else
              y.push(this.scalar(t, b, g));
          } else
            u[l] = this.scalar(t, b, g);
          break;
        case "message":
          if (f) {
            let y = u[l], E = c.T().internalBinaryRead(t, t.uint32(), a);
            y.push(E);
          } else
            u[l] = c.T().internalBinaryRead(t, t.uint32(), a, u[l]);
          break;
        case "map":
          let [m, p] = this.mapEntry(c, t, a);
          u[l][m] = p;
          break;
      }
    }
  }
  /**
   * Read a map field, expecting key field = 1, value field = 2
   */
  mapEntry(t, n, a) {
    let s = n.uint32(), r = n.pos + s, i, o;
    for (; n.pos < r; ) {
      let [c, u] = n.tag();
      switch (c) {
        case 1:
          t.K == A.BOOL ? i = n.bool().toString() : i = this.scalar(n, t.K, te.STRING);
          break;
        case 2:
          switch (t.V.kind) {
            case "scalar":
              o = this.scalar(n, t.V.T, t.V.L);
              break;
            case "enum":
              o = n.int32();
              break;
            case "message":
              o = t.V.T().internalBinaryRead(n, n.uint32(), a);
              break;
          }
          break;
        default:
          throw new Error(`Unknown field ${c} (wire type ${u}) in map entry for ${this.info.typeName}#${t.name}`);
      }
    }
    if (i === void 0) {
      let c = Ta(t.K);
      i = t.K == A.BOOL ? c.toString() : c;
    }
    if (o === void 0)
      switch (t.V.kind) {
        case "scalar":
          o = Ta(t.V.T, t.V.L);
          break;
        case "enum":
          o = 0;
          break;
        case "message":
          o = t.V.T().create();
          break;
      }
    return [i, o];
  }
  scalar(t, n, a) {
    switch (n) {
      case A.INT32:
        return t.int32();
      case A.STRING:
        return t.string();
      case A.BOOL:
        return t.bool();
      case A.DOUBLE:
        return t.double();
      case A.FLOAT:
        return t.float();
      case A.INT64:
        return Q0(t.int64(), a);
      case A.UINT64:
        return Q0(t.uint64(), a);
      case A.FIXED64:
        return Q0(t.fixed64(), a);
      case A.FIXED32:
        return t.fixed32();
      case A.BYTES:
        return t.bytes();
      case A.UINT32:
        return t.uint32();
      case A.SFIXED32:
        return t.sfixed32();
      case A.SFIXED64:
        return Q0(t.sfixed64(), a);
      case A.SINT32:
        return t.sint32();
      case A.SINT64:
        return Q0(t.sint64(), a);
    }
  }
}
class zu {
  constructor(t) {
    this.info = t;
  }
  prepare() {
    if (!this.fields) {
      const t = this.info.fields ? this.info.fields.concat() : [];
      this.fields = t.sort((n, a) => n.no - a.no);
    }
  }
  /**
   * Writes the message to binary format.
   */
  write(t, n, a) {
    this.prepare();
    for (const r of this.fields) {
      let i, o, c = r.repeat, u = r.localName;
      if (r.oneof) {
        const f = t[r.oneof];
        if (f.oneofKind !== u)
          continue;
        i = f[u], o = !0;
      } else
        i = t[u], o = !1;
      switch (r.kind) {
        case "scalar":
        case "enum":
          let f = r.kind == "enum" ? A.INT32 : r.T;
          if (c)
            if (V(Array.isArray(i)), c == yn.PACKED)
              this.packed(n, f, r.no, i);
            else
              for (const l of i)
                this.scalar(n, f, r.no, l, !0);
          else i === void 0 ? V(r.opt) : this.scalar(n, f, r.no, i, o || r.opt);
          break;
        case "message":
          if (c) {
            V(Array.isArray(i));
            for (const l of i)
              this.message(n, a, r.T(), r.no, l);
          } else
            this.message(n, a, r.T(), r.no, i);
          break;
        case "map":
          V(typeof i == "object" && i !== null);
          for (const [l, b] of Object.entries(i))
            this.mapEntry(n, a, r, l, b);
          break;
      }
    }
    let s = a.writeUnknownFields;
    s !== !1 && (s === !0 ? gn.onWrite : s)(this.info.typeName, t, n);
  }
  mapEntry(t, n, a, s, r) {
    t.tag(a.no, d0.LengthDelimited), t.fork();
    let i = s;
    switch (a.K) {
      case A.INT32:
      case A.FIXED32:
      case A.UINT32:
      case A.SFIXED32:
      case A.SINT32:
        i = Number.parseInt(s);
        break;
      case A.BOOL:
        V(s == "true" || s == "false"), i = s == "true";
        break;
    }
    switch (this.scalar(t, a.K, 1, i, !0), a.V.kind) {
      case "scalar":
        this.scalar(t, a.V.T, 2, r, !0);
        break;
      case "enum":
        this.scalar(t, A.INT32, 2, r, !0);
        break;
      case "message":
        this.message(t, n, a.V.T(), 2, r);
        break;
    }
    t.join();
  }
  message(t, n, a, s, r) {
    r !== void 0 && (a.internalBinaryWrite(r, t.tag(s, d0.LengthDelimited).fork(), n), t.join());
  }
  /**
   * Write a single scalar value.
   */
  scalar(t, n, a, s, r) {
    let [i, o, c] = this.scalarInfo(n, s);
    (!c || r) && (t.tag(a, i), t[o](s));
  }
  /**
   * Write an array of scalar values in packed format.
   */
  packed(t, n, a, s) {
    if (!s.length)
      return;
    V(n !== A.BYTES && n !== A.STRING), t.tag(a, d0.LengthDelimited), t.fork();
    let [, r] = this.scalarInfo(n);
    for (let i = 0; i < s.length; i++)
      t[r](s[i]);
    t.join();
  }
  /**
   * Get information for writing a scalar value.
   *
   * Returns tuple:
   * [0]: appropriate WireType
   * [1]: name of the appropriate method of IBinaryWriter
   * [2]: whether the given value is a default value
   *
   * If argument `value` is omitted, [2] is always false.
   */
  scalarInfo(t, n) {
    let a = d0.Varint, s, r = n === void 0, i = n === 0;
    switch (t) {
      case A.INT32:
        s = "int32";
        break;
      case A.STRING:
        i = r || !n.length, a = d0.LengthDelimited, s = "string";
        break;
      case A.BOOL:
        i = n === !1, s = "bool";
        break;
      case A.UINT32:
        s = "uint32";
        break;
      case A.DOUBLE:
        a = d0.Bit64, s = "double";
        break;
      case A.FLOAT:
        a = d0.Bit32, s = "float";
        break;
      case A.INT64:
        i = r || G.from(n).isZero(), s = "int64";
        break;
      case A.UINT64:
        i = r || y0.from(n).isZero(), s = "uint64";
        break;
      case A.FIXED64:
        i = r || y0.from(n).isZero(), a = d0.Bit64, s = "fixed64";
        break;
      case A.BYTES:
        i = r || !n.byteLength, a = d0.LengthDelimited, s = "bytes";
        break;
      case A.FIXED32:
        a = d0.Bit32, s = "fixed32";
        break;
      case A.SFIXED32:
        a = d0.Bit32, s = "sfixed32";
        break;
      case A.SFIXED64:
        i = r || G.from(n).isZero(), a = d0.Bit64, s = "sfixed64";
        break;
      case A.SINT32:
        s = "sint32";
        break;
      case A.SINT64:
        i = r || G.from(n).isZero(), s = "sint64";
        break;
    }
    return [a, s, r || i];
  }
}
function Gu(e) {
  const t = e.messagePrototype ? Object.create(e.messagePrototype) : Object.defineProperty({}, Oo, { value: e });
  for (let n of e.fields) {
    let a = n.localName;
    if (!n.opt)
      if (n.oneof)
        t[n.oneof] = { oneofKind: void 0 };
      else if (n.repeat)
        t[a] = [];
      else
        switch (n.kind) {
          case "scalar":
            t[a] = Ta(n.T, n.L);
            break;
          case "enum":
            t[a] = 0;
            break;
          case "map":
            t[a] = {};
            break;
        }
  }
  return t;
}
function Xn(e, t, n) {
  let a, s = n, r;
  for (let i of e.fields) {
    let o = i.localName;
    if (i.oneof) {
      const c = s[i.oneof];
      if (c?.oneofKind == null)
        continue;
      if (a = c[o], r = t[i.oneof], r.oneofKind = c.oneofKind, a == null) {
        delete r[o];
        continue;
      }
    } else if (a = s[o], r = t, a == null)
      continue;
    switch (i.repeat && (r[o].length = a.length), i.kind) {
      case "scalar":
      case "enum":
        if (i.repeat)
          for (let u = 0; u < a.length; u++)
            r[o][u] = a[u];
        else
          r[o] = a;
        break;
      case "message":
        let c = i.T();
        if (i.repeat)
          for (let u = 0; u < a.length; u++)
            r[o][u] = c.create(a[u]);
        else r[o] === void 0 ? r[o] = c.create(a) : c.mergePartial(r[o], a);
        break;
      case "map":
        switch (i.V.kind) {
          case "scalar":
          case "enum":
            Object.assign(r[o], a);
            break;
          case "message":
            let u = i.V.T();
            for (let f of Object.keys(a))
              r[o][f] = u.create(a[f]);
            break;
        }
        break;
    }
  }
}
function Wu(e, t, n) {
  if (t === n)
    return !0;
  if (!t || !n)
    return !1;
  for (let a of e.fields) {
    let s = a.localName, r = a.oneof ? t[a.oneof][s] : t[s], i = a.oneof ? n[a.oneof][s] : n[s];
    switch (a.kind) {
      case "enum":
      case "scalar":
        let o = a.kind == "enum" ? A.INT32 : a.T;
        if (!(a.repeat ? Ys(o, r, i) : Eo(o, r, i)))
          return !1;
        break;
      case "map":
        if (!(a.V.kind == "message" ? Zs(a.V.T(), Gt(r), Gt(i)) : Ys(a.V.kind == "enum" ? A.INT32 : a.V.T, Gt(r), Gt(i))))
          return !1;
        break;
      case "message":
        let c = a.T();
        if (!(a.repeat ? Zs(c, r, i) : c.equals(r, i)))
          return !1;
        break;
    }
  }
  return !0;
}
const Gt = Object.values;
function Eo(e, t, n) {
  if (t === n)
    return !0;
  if (e !== A.BYTES)
    return !1;
  let a = t, s = n;
  if (a.length !== s.length)
    return !1;
  for (let r = 0; r < a.length; r++)
    if (a[r] != s[r])
      return !1;
  return !0;
}
function Ys(e, t, n) {
  if (t.length !== n.length)
    return !1;
  for (let a = 0; a < t.length; a++)
    if (!Eo(e, t[a], n[a]))
      return !1;
  return !0;
}
function Zs(e, t, n) {
  if (t.length !== n.length)
    return !1;
  for (let a = 0; a < t.length; a++)
    if (!e.equals(t[a], n[a]))
      return !1;
  return !0;
}
const So = Object.getOwnPropertyDescriptors(Object.getPrototypeOf({})), Qu = So[Oo] = {};
class O {
  constructor(t, n, a) {
    this.defaultCheckDepth = 16, this.typeName = t, this.fields = n.map(Uu), this.options = a ?? {}, Qu.value = this, this.messagePrototype = Object.create(null, So), this.refTypeCheck = new Vu(this), this.refJsonReader = new Fu(this), this.refJsonWriter = new $u(this), this.refBinReader = new Lu(this), this.refBinWriter = new zu(this);
  }
  create(t) {
    let n = Gu(this);
    return t !== void 0 && Xn(this, n, t), n;
  }
  /**
   * Clone the message.
   *
   * Unknown fields are discarded.
   */
  clone(t) {
    let n = this.create();
    return Xn(this, n, t), n;
  }
  /**
   * Determines whether two message of the same type have the same field values.
   * Checks for deep equality, traversing repeated fields, oneof groups, maps
   * and messages recursively.
   * Will also return true if both messages are `undefined`.
   */
  equals(t, n) {
    return Wu(this, t, n);
  }
  /**
   * Is the given value assignable to our message type
   * and contains no [excess properties](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)?
   */
  is(t, n = this.defaultCheckDepth) {
    return this.refTypeCheck.is(t, n, !1);
  }
  /**
   * Is the given value assignable to our message type,
   * regardless of [excess properties](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)?
   */
  isAssignable(t, n = this.defaultCheckDepth) {
    return this.refTypeCheck.is(t, n, !0);
  }
  /**
   * Copy partial data into the target message.
   */
  mergePartial(t, n) {
    Xn(this, t, n);
  }
  /**
   * Create a new message from binary format.
   */
  fromBinary(t, n) {
    let a = Su(n);
    return this.internalBinaryRead(a.readerFactory(t), t.byteLength, a);
  }
  /**
   * Read a new message from a JSON value.
   */
  fromJson(t, n) {
    return this.internalJsonRead(t, Ru(n));
  }
  /**
   * Read a new message from a JSON string.
   * This is equivalent to `T.fromJson(JSON.parse(json))`.
   */
  fromJsonString(t, n) {
    let a = JSON.parse(t);
    return this.fromJson(a, n);
  }
  /**
   * Write the message to canonical JSON value.
   */
  toJson(t, n) {
    return this.internalJsonWrite(t, Du(n));
  }
  /**
   * Convert the message to canonical JSON string.
   * This is equivalent to `JSON.stringify(T.toJson(t))`
   */
  toJsonString(t, n) {
    var a;
    let s = this.toJson(t, n);
    return JSON.stringify(s, null, (a = n?.prettySpaces) !== null && a !== void 0 ? a : 0);
  }
  /**
   * Write the message to binary format.
   */
  toBinary(t, n) {
    let a = ju(n);
    return this.internalBinaryWrite(t, a.writerFactory(), a).finish();
  }
  /**
   * This is an internal method. If you just want to read a message from
   * JSON, use `fromJson()` or `fromJsonString()`.
   *
   * Reads JSON value and merges the fields into the target
   * according to protobuf rules. If the target is omitted,
   * a new instance is created first.
   */
  internalJsonRead(t, n, a) {
    if (t !== null && typeof t == "object" && !Array.isArray(t)) {
      let s = a ?? this.create();
      return this.refJsonReader.read(t, s, n), s;
    }
    throw new Error(`Unable to parse message ${this.typeName} from JSON ${qe(t)}.`);
  }
  /**
   * This is an internal method. If you just want to write a message
   * to JSON, use `toJson()` or `toJsonString().
   *
   * Writes JSON value and returns it.
   */
  internalJsonWrite(t, n) {
    return this.refJsonWriter.write(t, n);
  }
  /**
   * This is an internal method. If you just want to write a message
   * in binary format, use `toBinary()`.
   *
   * Serializes the message in binary format and appends it to the given
   * writer. Returns passed writer.
   */
  internalBinaryWrite(t, n, a) {
    return this.refBinWriter.write(t, n, a), n;
  }
  /**
   * This is an internal method. If you just want to read a message from
   * binary data, use `fromBinary()`.
   *
   * Reads data from binary format and merges the fields into
   * the target according to protobuf rules. If the target is
   * omitted, a new instance is created first.
   */
  internalBinaryRead(t, n, a, s) {
    let r = s ?? this.create();
    return this.refBinReader.read(t, r, a, n), r;
  }
}
var Ju = class extends O {
  constructor() {
    super("google.protobuf.Duration", [{
      no: 1,
      name: "seconds",
      kind: "scalar",
      T: 3,
      L: 0
    }, {
      no: 2,
      name: "nanos",
      kind: "scalar",
      T: 5
    }]);
  }
  /**
  * Encode `Duration` to JSON string like "3.000001s".
  */
  internalJsonWrite(e, t) {
    let n = G.from(e.seconds).toNumber();
    if (n > 315576e6 || n < -315576e6) throw new Error("Duration value out of range.");
    let a = e.seconds.toString();
    if (n === 0 && e.nanos < 0 && (a = "-" + a), e.nanos !== 0) {
      let s = Math.abs(e.nanos).toString();
      s = "0".repeat(9 - s.length) + s, s.substring(3) === "000000" ? s = s.substring(0, 3) : s.substring(6) === "000" && (s = s.substring(0, 6)), a += "." + s;
    }
    return a + "s";
  }
  /**
  * Decode `Duration` from JSON string like "3.000001s"
  */
  internalJsonRead(e, t, n) {
    if (typeof e != "string") throw new Error("Unable to parse Duration from JSON " + qe(e) + ". Expected string.");
    let a = e.match(/^(-?)([0-9]+)(?:\.([0-9]+))?s/);
    if (a === null) throw new Error("Unable to parse Duration from JSON string. Invalid format.");
    n || (n = this.create());
    let [, s, r, i] = a, o = G.from(s + r);
    if (o.toNumber() > 315576e6 || o.toNumber() < -315576e6) throw new Error("Unable to parse Duration from JSON string. Value out of range.");
    if (n.seconds = o.toBigInt(), typeof i == "string") {
      let c = s + i + "0".repeat(9 - i.length);
      n.nanos = parseInt(c);
    }
    return n;
  }
};
const Yu = new Ju();
var Zu = class extends O {
  constructor() {
    super("sui.rpc.v2.JwkId", [{
      no: 1,
      name: "iss",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "kid",
      kind: "scalar",
      opt: !0,
      T: 9
    }]);
  }
};
const qu = new Zu();
var Hu = class extends O {
  constructor() {
    super("sui.rpc.v2.Jwk", [
      {
        no: 1,
        name: "kty",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "e",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "n",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "alg",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const Xu = new Hu();
var Ku = class extends O {
  constructor() {
    super("sui.rpc.v2.Bcs", [{
      no: 1,
      name: "name",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "value",
      kind: "scalar",
      opt: !0,
      T: 12
    }]);
  }
};
const wn = new Ku();
let qs = /* @__PURE__ */ function(e) {
  return e[e.NULL_VALUE = 0] = "NULL_VALUE", e;
}({});
var el = class extends O {
  constructor() {
    super("google.protobuf.Struct", [{
      no: 1,
      name: "fields",
      kind: "map",
      K: 9,
      V: {
        kind: "message",
        T: () => ne
      }
    }]);
  }
  /**
  * Encode `Struct` to JSON object.
  */
  internalJsonWrite(e, t) {
    let n = {};
    for (let [a, s] of Object.entries(e.fields)) n[a] = ne.toJson(s);
    return n;
  }
  /**
  * Decode `Struct` from JSON object.
  */
  internalJsonRead(e, t, n) {
    if (!yo(e)) throw new globalThis.Error("Unable to parse message " + this.typeName + " from JSON " + qe(e) + ".");
    n || (n = this.create());
    for (let [a, s] of globalThis.Object.entries(e)) n.fields[a] = ne.fromJson(s);
    return n;
  }
};
const Hs = new el();
var tl = class extends O {
  constructor() {
    super("google.protobuf.Value", [
      {
        no: 1,
        name: "null_value",
        kind: "enum",
        oneof: "kind",
        T: () => ["google.protobuf.NullValue", qs]
      },
      {
        no: 2,
        name: "number_value",
        kind: "scalar",
        oneof: "kind",
        T: 1
      },
      {
        no: 3,
        name: "string_value",
        kind: "scalar",
        oneof: "kind",
        T: 9
      },
      {
        no: 4,
        name: "bool_value",
        kind: "scalar",
        oneof: "kind",
        T: 8
      },
      {
        no: 5,
        name: "struct_value",
        kind: "message",
        oneof: "kind",
        T: () => Hs
      },
      {
        no: 6,
        name: "list_value",
        kind: "message",
        oneof: "kind",
        T: () => Xs
      }
    ]);
  }
  /**
  * Encode `Value` to JSON value.
  */
  internalJsonWrite(e, t) {
    if (e.kind.oneofKind === void 0) throw new globalThis.Error();
    switch (e.kind.oneofKind) {
      case void 0:
        throw new globalThis.Error();
      case "boolValue":
        return e.kind.boolValue;
      case "nullValue":
        return null;
      case "numberValue":
        let n = e.kind.numberValue;
        if (typeof n == "number" && !Number.isFinite(n)) throw new globalThis.Error();
        return n;
      case "stringValue":
        return e.kind.stringValue;
      case "listValue":
        let a = this.fields.find((r) => r.no === 6);
        if (a?.kind !== "message") throw new globalThis.Error();
        return a.T().toJson(e.kind.listValue);
      case "structValue":
        let s = this.fields.find((r) => r.no === 5);
        if (s?.kind !== "message") throw new globalThis.Error();
        return s.T().toJson(e.kind.structValue);
    }
  }
  /**
  * Decode `Value` from JSON value.
  */
  internalJsonRead(e, t, n) {
    switch (n || (n = this.create()), typeof e) {
      case "number":
        n.kind = {
          oneofKind: "numberValue",
          numberValue: e
        };
        break;
      case "string":
        n.kind = {
          oneofKind: "stringValue",
          stringValue: e
        };
        break;
      case "boolean":
        n.kind = {
          oneofKind: "boolValue",
          boolValue: e
        };
        break;
      case "object":
        e === null ? n.kind = {
          oneofKind: "nullValue",
          nullValue: qs.NULL_VALUE
        } : globalThis.Array.isArray(e) ? n.kind = {
          oneofKind: "listValue",
          listValue: Xs.fromJson(e)
        } : n.kind = {
          oneofKind: "structValue",
          structValue: Hs.fromJson(e)
        };
        break;
      default:
        throw new globalThis.Error("Unable to parse " + this.typeName + " from JSON " + qe(e));
    }
    return n;
  }
};
const ne = new tl();
var nl = class extends O {
  constructor() {
    super("google.protobuf.ListValue", [{
      no: 1,
      name: "values",
      kind: "message",
      repeat: 2,
      T: () => ne
    }]);
  }
  /**
  * Encode `ListValue` to JSON array.
  */
  internalJsonWrite(e, t) {
    return e.values.map((n) => ne.toJson(n));
  }
  /**
  * Decode `ListValue` from JSON array.
  */
  internalJsonRead(e, t, n) {
    if (!globalThis.Array.isArray(e)) throw new globalThis.Error("Unable to parse " + this.typeName + " from JSON " + qe(e));
    n || (n = this.create());
    let a = e.map((s) => ne.fromJson(s));
    return n.values.push(...a), n;
  }
};
const Xs = new nl();
let al = /* @__PURE__ */ function(e) {
  return e[e.DATATYPE_KIND_UNKNOWN = 0] = "DATATYPE_KIND_UNKNOWN", e[e.STRUCT = 1] = "STRUCT", e[e.ENUM = 2] = "ENUM", e;
}({}), sl = /* @__PURE__ */ function(e) {
  return e[e.TYPE_UNKNOWN = 0] = "TYPE_UNKNOWN", e[e.ADDRESS = 1] = "ADDRESS", e[e.BOOL = 2] = "BOOL", e[e.U8 = 3] = "U8", e[e.U16 = 4] = "U16", e[e.U32 = 5] = "U32", e[e.U64 = 6] = "U64", e[e.U128 = 7] = "U128", e[e.U256 = 8] = "U256", e[e.VECTOR = 9] = "VECTOR", e[e.DATATYPE = 10] = "DATATYPE", e[e.TYPE_PARAMETER = 11] = "TYPE_PARAMETER", e;
}({}), rl = /* @__PURE__ */ function(e) {
  return e[e.VISIBILITY_UNKNOWN = 0] = "VISIBILITY_UNKNOWN", e[e.PRIVATE = 1] = "PRIVATE", e[e.PUBLIC = 2] = "PUBLIC", e[e.FRIEND = 3] = "FRIEND", e;
}({}), il = /* @__PURE__ */ function(e) {
  return e[e.REFERENCE_UNKNOWN = 0] = "REFERENCE_UNKNOWN", e[e.IMMUTABLE = 1] = "IMMUTABLE", e[e.MUTABLE = 2] = "MUTABLE", e;
}({}), ko = /* @__PURE__ */ function(e) {
  return e[e.ABILITY_UNKNOWN = 0] = "ABILITY_UNKNOWN", e[e.COPY = 1] = "COPY", e[e.DROP = 2] = "DROP", e[e.STORE = 3] = "STORE", e[e.KEY = 4] = "KEY", e;
}({});
var ol = class extends O {
  constructor() {
    super("sui.rpc.v2.Package", [
      {
        no: 1,
        name: "storage_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "original_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "modules",
        kind: "message",
        repeat: 2,
        T: () => fl
      },
      {
        no: 5,
        name: "type_origins",
        kind: "message",
        repeat: 2,
        T: () => Tl
      },
      {
        no: 6,
        name: "linkage",
        kind: "message",
        repeat: 2,
        T: () => Ol
      }
    ]);
  }
};
const cl = new ol();
var dl = class extends O {
  constructor() {
    super("sui.rpc.v2.Module", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "contents",
        kind: "scalar",
        opt: !0,
        T: 12
      },
      {
        no: 3,
        name: "datatypes",
        kind: "message",
        repeat: 2,
        T: () => ll
      },
      {
        no: 4,
        name: "functions",
        kind: "message",
        repeat: 2,
        T: () => yl
      }
    ]);
  }
};
const fl = new dl();
var ul = class extends O {
  constructor() {
    super("sui.rpc.v2.DatatypeDescriptor", [
      {
        no: 1,
        name: "type_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "defining_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "module",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "abilities",
        kind: "enum",
        repeat: 1,
        T: () => ["sui.rpc.v2.Ability", ko]
      },
      {
        no: 6,
        name: "type_parameters",
        kind: "message",
        repeat: 2,
        T: () => No
      },
      {
        no: 7,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.DatatypeDescriptor.DatatypeKind", al]
      },
      {
        no: 8,
        name: "fields",
        kind: "message",
        repeat: 2,
        T: () => Co
      },
      {
        no: 9,
        name: "variants",
        kind: "message",
        repeat: 2,
        T: () => gl
      }
    ]);
  }
};
const ll = new ul();
var bl = class extends O {
  constructor() {
    super("sui.rpc.v2.TypeParameter", [{
      no: 1,
      name: "constraints",
      kind: "enum",
      repeat: 1,
      T: () => ["sui.rpc.v2.Ability", ko]
    }, {
      no: 2,
      name: "is_phantom",
      kind: "scalar",
      opt: !0,
      T: 8
    }]);
  }
};
const No = new bl();
var pl = class extends O {
  constructor() {
    super("sui.rpc.v2.FieldDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "position",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 3,
        name: "type",
        kind: "message",
        T: () => Ja
      }
    ]);
  }
};
const Co = new pl();
var ml = class extends O {
  constructor() {
    super("sui.rpc.v2.VariantDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "position",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 3,
        name: "fields",
        kind: "message",
        repeat: 2,
        T: () => Co
      }
    ]);
  }
};
const gl = new ml();
var hl = class extends O {
  constructor() {
    super("sui.rpc.v2.OpenSignatureBody", [
      {
        no: 1,
        name: "type",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.OpenSignatureBody.Type", sl]
      },
      {
        no: 2,
        name: "type_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "type_parameter_instantiation",
        kind: "message",
        repeat: 2,
        T: () => Ja
      },
      {
        no: 4,
        name: "type_parameter",
        kind: "scalar",
        opt: !0,
        T: 13
      }
    ]);
  }
};
const Ja = new hl();
var Al = class extends O {
  constructor() {
    super("sui.rpc.v2.FunctionDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "visibility",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.FunctionDescriptor.Visibility", rl]
      },
      {
        no: 6,
        name: "is_entry",
        kind: "scalar",
        opt: !0,
        T: 8
      },
      {
        no: 7,
        name: "type_parameters",
        kind: "message",
        repeat: 2,
        T: () => No
      },
      {
        no: 8,
        name: "parameters",
        kind: "message",
        repeat: 2,
        T: () => Ks
      },
      {
        no: 9,
        name: "returns",
        kind: "message",
        repeat: 2,
        T: () => Ks
      }
    ]);
  }
};
const yl = new Al();
var wl = class extends O {
  constructor() {
    super("sui.rpc.v2.OpenSignature", [{
      no: 1,
      name: "reference",
      kind: "enum",
      opt: !0,
      T: () => ["sui.rpc.v2.OpenSignature.Reference", il]
    }, {
      no: 2,
      name: "body",
      kind: "message",
      T: () => Ja
    }]);
  }
};
const Ks = new wl();
var vl = class extends O {
  constructor() {
    super("sui.rpc.v2.TypeOrigin", [
      {
        no: 1,
        name: "module_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "datatype_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "package_id",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const Tl = new vl();
var Il = class extends O {
  constructor() {
    super("sui.rpc.v2.Linkage", [
      {
        no: 1,
        name: "original_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "upgraded_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "upgraded_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Ol = new Il();
let El = /* @__PURE__ */ function(e) {
  return e[e.OWNER_KIND_UNKNOWN = 0] = "OWNER_KIND_UNKNOWN", e[e.ADDRESS = 1] = "ADDRESS", e[e.OBJECT = 2] = "OBJECT", e[e.SHARED = 3] = "SHARED", e[e.IMMUTABLE = 4] = "IMMUTABLE", e[e.CONSENSUS_ADDRESS = 5] = "CONSENSUS_ADDRESS", e;
}({});
var Sl = class extends O {
  constructor() {
    super("sui.rpc.v2.Owner", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Owner.OwnerKind", El]
      },
      {
        no: 2,
        name: "address",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Ia = new Sl();
var kl = class extends O {
  constructor() {
    super("sui.rpc.v2.Object", [
      {
        no: 1,
        name: "bcs",
        kind: "message",
        T: () => wn
      },
      {
        no: 2,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "owner",
        kind: "message",
        T: () => Ia
      },
      {
        no: 6,
        name: "object_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 7,
        name: "has_public_transfer",
        kind: "scalar",
        opt: !0,
        T: 8
      },
      {
        no: 8,
        name: "contents",
        kind: "message",
        T: () => wn
      },
      {
        no: 9,
        name: "package",
        kind: "message",
        T: () => cl
      },
      {
        no: 10,
        name: "previous_transaction",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 11,
        name: "storage_rebate",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 100,
        name: "json",
        kind: "message",
        T: () => ne
      },
      {
        no: 101,
        name: "balance",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 102,
        name: "display",
        kind: "message",
        T: () => xl
      }
    ]);
  }
};
const xo = new kl();
var Nl = class extends O {
  constructor() {
    super("sui.rpc.v2.ObjectSet", [{
      no: 1,
      name: "objects",
      kind: "message",
      repeat: 2,
      T: () => xo
    }]);
  }
};
new Nl();
var Cl = class extends O {
  constructor() {
    super("sui.rpc.v2.Display", [{
      no: 1,
      name: "output",
      kind: "message",
      T: () => ne
    }, {
      no: 2,
      name: "errors",
      kind: "message",
      T: () => ne
    }]);
  }
};
const xl = new Cl();
let xe = /* @__PURE__ */ function(e) {
  return e[e.ARGUMENT_KIND_UNKNOWN = 0] = "ARGUMENT_KIND_UNKNOWN", e[e.GAS = 1] = "GAS", e[e.INPUT = 2] = "INPUT", e[e.RESULT = 3] = "RESULT", e;
}({});
var _l = class extends O {
  constructor() {
    super("sui.rpc.v2.Argument", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Argument.ArgumentKind", xe]
      },
      {
        no: 2,
        name: "input",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 3,
        name: "result",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 4,
        name: "subresult",
        kind: "scalar",
        opt: !0,
        T: 13
      }
    ]);
  }
};
const ye = new _l();
let J0 = /* @__PURE__ */ function(e) {
  return e[e.INPUT_KIND_UNKNOWN = 0] = "INPUT_KIND_UNKNOWN", e[e.PURE = 1] = "PURE", e[e.IMMUTABLE_OR_OWNED = 2] = "IMMUTABLE_OR_OWNED", e[e.SHARED = 3] = "SHARED", e[e.RECEIVING = 4] = "RECEIVING", e[e.FUNDS_WITHDRAWAL = 5] = "FUNDS_WITHDRAWAL", e;
}({}), Bl = /* @__PURE__ */ function(e) {
  return e[e.MUTABILITY_UNKNOWN = 0] = "MUTABILITY_UNKNOWN", e[e.IMMUTABLE = 1] = "IMMUTABLE", e[e.MUTABLE = 2] = "MUTABLE", e[e.NON_EXCLUSIVE_WRITE = 3] = "NON_EXCLUSIVE_WRITE", e;
}({}), vn = /* @__PURE__ */ function(e) {
  return e[e.SOURCE_UNKNOWN = 0] = "SOURCE_UNKNOWN", e[e.SENDER = 1] = "SENDER", e[e.SPONSOR = 2] = "SPONSOR", e;
}({});
var jl = class extends O {
  constructor() {
    super("sui.rpc.v2.Input", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Input.InputKind", J0]
      },
      {
        no: 2,
        name: "pure",
        kind: "scalar",
        opt: !0,
        T: 12
      },
      {
        no: 3,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 6,
        name: "mutable",
        kind: "scalar",
        opt: !0,
        T: 8
      },
      {
        no: 7,
        name: "mutability",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Input.Mutability", Bl]
      },
      {
        no: 8,
        name: "funds_withdrawal",
        kind: "message",
        T: () => Dl
      },
      {
        no: 1e3,
        name: "literal",
        kind: "message",
        T: () => ne
      }
    ]);
  }
};
const Ml = new jl();
var Rl = class extends O {
  constructor() {
    super("sui.rpc.v2.FundsWithdrawal", [
      {
        no: 1,
        name: "amount",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "coin_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "source",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.FundsWithdrawal.Source", vn]
      }
    ]);
  }
};
const Dl = new Rl();
var Ul = class extends O {
  constructor() {
    super("google.protobuf.Timestamp", [{
      no: 1,
      name: "seconds",
      kind: "scalar",
      T: 3,
      L: 0
    }, {
      no: 2,
      name: "nanos",
      kind: "scalar",
      T: 5
    }]);
  }
  /**
  * Creates a new `Timestamp` for the current time.
  */
  now() {
    const e = this.create(), t = Date.now();
    return e.seconds = G.from(Math.floor(t / 1e3)).toBigInt(), e.nanos = t % 1e3 * 1e6, e;
  }
  /**
  * Converts a `Timestamp` to a JavaScript Date.
  */
  toDate(e) {
    return new Date(G.from(e.seconds).toNumber() * 1e3 + Math.ceil(e.nanos / 1e6));
  }
  /**
  * Converts a JavaScript Date to a `Timestamp`.
  */
  fromDate(e) {
    const t = this.create(), n = e.getTime();
    return t.seconds = G.from(Math.floor(n / 1e3)).toBigInt(), t.nanos = (n % 1e3 + (n < 0 && n % 1e3 !== 0 ? 1e3 : 0)) * 1e6, t;
  }
  /**
  * In JSON format, the `Timestamp` type is encoded as a string
  * in the RFC 3339 format.
  */
  internalJsonWrite(e, t) {
    let n = G.from(e.seconds).toNumber() * 1e3;
    if (n < Date.parse("0001-01-01T00:00:00Z") || n > Date.parse("9999-12-31T23:59:59Z")) throw new Error("Unable to encode Timestamp to JSON. Must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive.");
    if (e.nanos < 0) throw new Error("Unable to encode invalid Timestamp to JSON. Nanos must not be negative.");
    let a = "Z";
    if (e.nanos > 0) {
      let s = (e.nanos + 1e9).toString().substring(1);
      s.substring(3) === "000000" ? a = "." + s.substring(0, 3) + "Z" : s.substring(6) === "000" ? a = "." + s.substring(0, 6) + "Z" : a = "." + s + "Z";
    }
    return new Date(n).toISOString().replace(".000Z", a);
  }
  /**
  * In JSON format, the `Timestamp` type is encoded as a string
  * in the RFC 3339 format.
  */
  internalJsonRead(e, t, n) {
    if (typeof e != "string") throw new Error("Unable to parse Timestamp from JSON " + qe(e) + ".");
    let a = e.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:Z|\.([0-9]{3,9})Z|([+-][0-9][0-9]:[0-9][0-9]))$/);
    if (!a) throw new Error("Unable to parse Timestamp from JSON. Invalid format.");
    let s = Date.parse(a[1] + "-" + a[2] + "-" + a[3] + "T" + a[4] + ":" + a[5] + ":" + a[6] + (a[8] ? a[8] : "Z"));
    if (Number.isNaN(s)) throw new Error("Unable to parse Timestamp from JSON. Invalid value.");
    if (s < Date.parse("0001-01-01T00:00:00Z") || s > Date.parse("9999-12-31T23:59:59Z")) throw new globalThis.Error("Unable to parse Timestamp from JSON. Must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive.");
    return n || (n = this.create()), n.seconds = G.from(s / 1e3).toBigInt(), n.nanos = 0, a[7] && (n.nanos = parseInt("1" + a[7] + "0".repeat(9 - a[7].length)) - 1e9), n;
  }
};
const Tn = new Ul();
var Pl = class extends O {
  constructor() {
    super("sui.rpc.v2.ObjectReference", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const _o = new Pl();
let We = /* @__PURE__ */ function(e) {
  return e[e.TRANSACTION_EXPIRATION_KIND_UNKNOWN = 0] = "TRANSACTION_EXPIRATION_KIND_UNKNOWN", e[e.NONE = 1] = "NONE", e[e.EPOCH = 2] = "EPOCH", e[e.VALID_DURING = 3] = "VALID_DURING", e;
}({}), Vl = /* @__PURE__ */ function(e) {
  return e[e.KIND_UNKNOWN = 0] = "KIND_UNKNOWN", e[e.PROGRAMMABLE_TRANSACTION = 1] = "PROGRAMMABLE_TRANSACTION", e[e.CHANGE_EPOCH = 2] = "CHANGE_EPOCH", e[e.GENESIS = 3] = "GENESIS", e[e.CONSENSUS_COMMIT_PROLOGUE_V1 = 4] = "CONSENSUS_COMMIT_PROLOGUE_V1", e[e.AUTHENTICATOR_STATE_UPDATE = 5] = "AUTHENTICATOR_STATE_UPDATE", e[e.END_OF_EPOCH = 6] = "END_OF_EPOCH", e[e.RANDOMNESS_STATE_UPDATE = 7] = "RANDOMNESS_STATE_UPDATE", e[e.CONSENSUS_COMMIT_PROLOGUE_V2 = 8] = "CONSENSUS_COMMIT_PROLOGUE_V2", e[e.CONSENSUS_COMMIT_PROLOGUE_V3 = 9] = "CONSENSUS_COMMIT_PROLOGUE_V3", e[e.CONSENSUS_COMMIT_PROLOGUE_V4 = 10] = "CONSENSUS_COMMIT_PROLOGUE_V4", e[e.PROGRAMMABLE_SYSTEM_TRANSACTION = 11] = "PROGRAMMABLE_SYSTEM_TRANSACTION", e;
}({}), Fl = /* @__PURE__ */ function(e) {
  return e[e.KIND_UNKNOWN = 0] = "KIND_UNKNOWN", e[e.CHANGE_EPOCH = 1] = "CHANGE_EPOCH", e[e.AUTHENTICATOR_STATE_CREATE = 2] = "AUTHENTICATOR_STATE_CREATE", e[e.AUTHENTICATOR_STATE_EXPIRE = 3] = "AUTHENTICATOR_STATE_EXPIRE", e[e.RANDOMNESS_STATE_CREATE = 4] = "RANDOMNESS_STATE_CREATE", e[e.DENY_LIST_STATE_CREATE = 5] = "DENY_LIST_STATE_CREATE", e[e.BRIDGE_STATE_CREATE = 6] = "BRIDGE_STATE_CREATE", e[e.BRIDGE_COMMITTEE_INIT = 7] = "BRIDGE_COMMITTEE_INIT", e[e.STORE_EXECUTION_TIME_OBSERVATIONS = 8] = "STORE_EXECUTION_TIME_OBSERVATIONS", e[e.ACCUMULATOR_ROOT_CREATE = 9] = "ACCUMULATOR_ROOT_CREATE", e[e.COIN_REGISTRY_CREATE = 10] = "COIN_REGISTRY_CREATE", e[e.DISPLAY_REGISTRY_CREATE = 11] = "DISPLAY_REGISTRY_CREATE", e[e.ADDRESS_ALIAS_STATE_CREATE = 12] = "ADDRESS_ALIAS_STATE_CREATE", e[e.WRITE_ACCUMULATOR_STORAGE_COST = 13] = "WRITE_ACCUMULATOR_STORAGE_COST", e;
}({}), $l = /* @__PURE__ */ function(e) {
  return e[e.EXECUTION_TIME_OBSERVATION_KIND_UNKNOWN = 0] = "EXECUTION_TIME_OBSERVATION_KIND_UNKNOWN", e[e.MOVE_ENTRY_POINT = 1] = "MOVE_ENTRY_POINT", e[e.TRANSFER_OBJECTS = 2] = "TRANSFER_OBJECTS", e[e.SPLIT_COINS = 3] = "SPLIT_COINS", e[e.MERGE_COINS = 4] = "MERGE_COINS", e[e.PUBLISH = 5] = "PUBLISH", e[e.MAKE_MOVE_VECTOR = 6] = "MAKE_MOVE_VECTOR", e[e.UPGRADE = 7] = "UPGRADE", e;
}({});
var Ll = class extends O {
  constructor() {
    super("sui.rpc.v2.Transaction", [
      {
        no: 1,
        name: "bcs",
        kind: "message",
        T: () => wn
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 5
      },
      {
        no: 4,
        name: "kind",
        kind: "message",
        T: () => Yl
      },
      {
        no: 5,
        name: "sender",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 6,
        name: "gas_payment",
        kind: "message",
        T: () => Gl
      },
      {
        no: 7,
        name: "expiration",
        kind: "message",
        T: () => Ql
      }
    ]);
  }
};
const Ya = new Ll();
var zl = class extends O {
  constructor() {
    super("sui.rpc.v2.GasPayment", [
      {
        no: 1,
        name: "objects",
        kind: "message",
        repeat: 2,
        T: () => _o
      },
      {
        no: 2,
        name: "owner",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "price",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "budget",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Gl = new zl();
var Wl = class extends O {
  constructor() {
    super("sui.rpc.v2.TransactionExpiration", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.TransactionExpiration.TransactionExpirationKind", We]
      },
      {
        no: 2,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "min_epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "min_timestamp",
        kind: "message",
        T: () => Tn
      },
      {
        no: 5,
        name: "max_timestamp",
        kind: "message",
        T: () => Tn
      },
      {
        no: 6,
        name: "chain",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 7,
        name: "nonce",
        kind: "scalar",
        opt: !0,
        T: 13
      }
    ]);
  }
};
const Ql = new Wl();
var Jl = class extends O {
  constructor() {
    super("sui.rpc.v2.TransactionKind", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.TransactionKind.Kind", Vl]
      },
      {
        no: 2,
        name: "programmable_transaction",
        kind: "message",
        oneof: "data",
        T: () => ql
      },
      {
        no: 3,
        name: "change_epoch",
        kind: "message",
        oneof: "data",
        T: () => jo
      },
      {
        no: 4,
        name: "genesis",
        kind: "message",
        oneof: "data",
        T: () => Ab
      },
      {
        no: 5,
        name: "consensus_commit_prologue",
        kind: "message",
        oneof: "data",
        T: () => wb
      },
      {
        no: 6,
        name: "authenticator_state_update",
        kind: "message",
        oneof: "data",
        T: () => Nb
      },
      {
        no: 7,
        name: "end_of_epoch",
        kind: "message",
        oneof: "data",
        T: () => Bb
      },
      {
        no: 8,
        name: "randomness_state_update",
        kind: "message",
        oneof: "data",
        T: () => bb
      }
    ]);
  }
};
const Yl = new Jl();
var Zl = class extends O {
  constructor() {
    super("sui.rpc.v2.ProgrammableTransaction", [{
      no: 1,
      name: "inputs",
      kind: "message",
      repeat: 2,
      T: () => Ml
    }, {
      no: 2,
      name: "commands",
      kind: "message",
      repeat: 2,
      T: () => Xl
    }]);
  }
};
const ql = new Zl();
var Hl = class extends O {
  constructor() {
    super("sui.rpc.v2.Command", [
      {
        no: 1,
        name: "move_call",
        kind: "message",
        oneof: "command",
        T: () => Bo
      },
      {
        no: 2,
        name: "transfer_objects",
        kind: "message",
        oneof: "command",
        T: () => tb
      },
      {
        no: 3,
        name: "split_coins",
        kind: "message",
        oneof: "command",
        T: () => ab
      },
      {
        no: 4,
        name: "merge_coins",
        kind: "message",
        oneof: "command",
        T: () => rb
      },
      {
        no: 5,
        name: "publish",
        kind: "message",
        oneof: "command",
        T: () => ob
      },
      {
        no: 6,
        name: "make_move_vector",
        kind: "message",
        oneof: "command",
        T: () => db
      },
      {
        no: 7,
        name: "upgrade",
        kind: "message",
        oneof: "command",
        T: () => ub
      }
    ]);
  }
};
const Xl = new Hl();
var Kl = class extends O {
  constructor() {
    super("sui.rpc.v2.MoveCall", [
      {
        no: 1,
        name: "package",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "module",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "function",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "type_arguments",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 5,
        name: "arguments",
        kind: "message",
        repeat: 2,
        T: () => ye
      }
    ]);
  }
};
const Bo = new Kl();
var eb = class extends O {
  constructor() {
    super("sui.rpc.v2.TransferObjects", [{
      no: 1,
      name: "objects",
      kind: "message",
      repeat: 2,
      T: () => ye
    }, {
      no: 2,
      name: "address",
      kind: "message",
      T: () => ye
    }]);
  }
};
const tb = new eb();
var nb = class extends O {
  constructor() {
    super("sui.rpc.v2.SplitCoins", [{
      no: 1,
      name: "coin",
      kind: "message",
      T: () => ye
    }, {
      no: 2,
      name: "amounts",
      kind: "message",
      repeat: 2,
      T: () => ye
    }]);
  }
};
const ab = new nb();
var sb = class extends O {
  constructor() {
    super("sui.rpc.v2.MergeCoins", [{
      no: 1,
      name: "coin",
      kind: "message",
      T: () => ye
    }, {
      no: 2,
      name: "coins_to_merge",
      kind: "message",
      repeat: 2,
      T: () => ye
    }]);
  }
};
const rb = new sb();
var ib = class extends O {
  constructor() {
    super("sui.rpc.v2.Publish", [{
      no: 1,
      name: "modules",
      kind: "scalar",
      repeat: 2,
      T: 12
    }, {
      no: 2,
      name: "dependencies",
      kind: "scalar",
      repeat: 2,
      T: 9
    }]);
  }
};
const ob = new ib();
var cb = class extends O {
  constructor() {
    super("sui.rpc.v2.MakeMoveVector", [{
      no: 1,
      name: "element_type",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "elements",
      kind: "message",
      repeat: 2,
      T: () => ye
    }]);
  }
};
const db = new cb();
var fb = class extends O {
  constructor() {
    super("sui.rpc.v2.Upgrade", [
      {
        no: 1,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 2,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 3,
        name: "package",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "ticket",
        kind: "message",
        T: () => ye
      }
    ]);
  }
};
const ub = new fb();
var lb = class extends O {
  constructor() {
    super("sui.rpc.v2.RandomnessStateUpdate", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "randomness_round",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "random_bytes",
        kind: "scalar",
        opt: !0,
        T: 12
      },
      {
        no: 4,
        name: "randomness_object_initial_shared_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const bb = new lb();
var pb = class extends O {
  constructor() {
    super("sui.rpc.v2.ChangeEpoch", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "protocol_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "storage_charge",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "computation_charge",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "storage_rebate",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "non_refundable_storage_fee",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "epoch_start_timestamp",
        kind: "message",
        T: () => Tn
      },
      {
        no: 8,
        name: "system_packages",
        kind: "message",
        repeat: 2,
        T: () => gb
      }
    ]);
  }
};
const jo = new pb();
var mb = class extends O {
  constructor() {
    super("sui.rpc.v2.SystemPackage", [
      {
        no: 1,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 3,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      }
    ]);
  }
};
const gb = new mb();
var hb = class extends O {
  constructor() {
    super("sui.rpc.v2.GenesisTransaction", [{
      no: 1,
      name: "objects",
      kind: "message",
      repeat: 2,
      T: () => xo
    }]);
  }
};
const Ab = new hb();
var yb = class extends O {
  constructor() {
    super("sui.rpc.v2.ConsensusCommitPrologue", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "round",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "commit_timestamp",
        kind: "message",
        T: () => Tn
      },
      {
        no: 4,
        name: "consensus_commit_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "sub_dag_index",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "consensus_determined_version_assignments",
        kind: "message",
        T: () => Sb
      },
      {
        no: 7,
        name: "additional_state_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const wb = new yb();
var vb = class extends O {
  constructor() {
    super("sui.rpc.v2.VersionAssignment", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "start_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Tb = new vb();
var Ib = class extends O {
  constructor() {
    super("sui.rpc.v2.CanceledTransaction", [{
      no: 1,
      name: "digest",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "version_assignments",
      kind: "message",
      repeat: 2,
      T: () => Tb
    }]);
  }
};
const Ob = new Ib();
var Eb = class extends O {
  constructor() {
    super("sui.rpc.v2.ConsensusDeterminedVersionAssignments", [{
      no: 1,
      name: "version",
      kind: "scalar",
      opt: !0,
      T: 5
    }, {
      no: 3,
      name: "canceled_transactions",
      kind: "message",
      repeat: 2,
      T: () => Ob
    }]);
  }
};
const Sb = new Eb();
var kb = class extends O {
  constructor() {
    super("sui.rpc.v2.AuthenticatorStateUpdate", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "round",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "new_active_jwks",
        kind: "message",
        repeat: 2,
        T: () => xb
      },
      {
        no: 4,
        name: "authenticator_object_initial_shared_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Nb = new kb();
var Cb = class extends O {
  constructor() {
    super("sui.rpc.v2.ActiveJwk", [
      {
        no: 1,
        name: "id",
        kind: "message",
        T: () => qu
      },
      {
        no: 2,
        name: "jwk",
        kind: "message",
        T: () => Xu
      },
      {
        no: 3,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const xb = new Cb();
var _b = class extends O {
  constructor() {
    super("sui.rpc.v2.EndOfEpochTransaction", [{
      no: 1,
      name: "transactions",
      kind: "message",
      repeat: 2,
      T: () => Mb
    }]);
  }
};
const Bb = new _b();
var jb = class extends O {
  constructor() {
    super("sui.rpc.v2.EndOfEpochTransactionKind", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.EndOfEpochTransactionKind.Kind", Fl]
      },
      {
        no: 2,
        name: "change_epoch",
        kind: "message",
        oneof: "data",
        T: () => jo
      },
      {
        no: 3,
        name: "authenticator_state_expire",
        kind: "message",
        oneof: "data",
        T: () => Db
      },
      {
        no: 4,
        name: "execution_time_observations",
        kind: "message",
        oneof: "data",
        T: () => Pb
      },
      {
        no: 5,
        name: "bridge_chain_id",
        kind: "scalar",
        oneof: "data",
        T: 9
      },
      {
        no: 6,
        name: "bridge_object_version",
        kind: "scalar",
        oneof: "data",
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "storage_cost",
        kind: "scalar",
        oneof: "data",
        T: 4,
        L: 0
      }
    ]);
  }
};
const Mb = new jb();
var Rb = class extends O {
  constructor() {
    super("sui.rpc.v2.AuthenticatorStateExpire", [{
      no: 1,
      name: "min_epoch",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }, {
      no: 2,
      name: "authenticator_object_initial_shared_version",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }]);
  }
};
const Db = new Rb();
var Ub = class extends O {
  constructor() {
    super("sui.rpc.v2.ExecutionTimeObservations", [{
      no: 1,
      name: "version",
      kind: "scalar",
      opt: !0,
      T: 5
    }, {
      no: 2,
      name: "observations",
      kind: "message",
      repeat: 2,
      T: () => Fb
    }]);
  }
};
const Pb = new Ub();
var Vb = class extends O {
  constructor() {
    super("sui.rpc.v2.ExecutionTimeObservation", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.ExecutionTimeObservation.ExecutionTimeObservationKind", $l]
      },
      {
        no: 2,
        name: "move_entry_point",
        kind: "message",
        T: () => Bo
      },
      {
        no: 3,
        name: "validator_observations",
        kind: "message",
        repeat: 2,
        T: () => Lb
      }
    ]);
  }
};
const Fb = new Vb();
var $b = class extends O {
  constructor() {
    super("sui.rpc.v2.ValidatorExecutionTimeObservation", [{
      no: 1,
      name: "validator",
      kind: "scalar",
      opt: !0,
      T: 12
    }, {
      no: 2,
      name: "duration",
      kind: "message",
      T: () => Yu
    }]);
  }
};
const Lb = new $b();
function zb(e) {
  switch (e.$kind) {
    case "Pure":
      return {
        kind: J0.PURE,
        pure: j0(e.Pure.bytes)
      };
    case "Object":
      if (e.Object.$kind === "ImmOrOwnedObject") return {
        kind: J0.IMMUTABLE_OR_OWNED,
        objectId: e.Object.ImmOrOwnedObject.objectId,
        version: BigInt(e.Object.ImmOrOwnedObject.version),
        digest: e.Object.ImmOrOwnedObject.digest
      };
      if (e.Object.$kind === "SharedObject") return {
        kind: J0.SHARED,
        objectId: e.Object.SharedObject.objectId,
        version: BigInt(e.Object.SharedObject.initialSharedVersion),
        mutable: e.Object.SharedObject.mutable
      };
      if (e.Object.$kind === "Receiving") return {
        kind: J0.RECEIVING,
        objectId: e.Object.Receiving.objectId,
        version: BigInt(e.Object.Receiving.version),
        digest: e.Object.Receiving.digest
      };
      throw new Error(`Unknown Object kind: ${JSON.stringify(e.Object)}`);
    case "UnresolvedObject":
      const t = e.UnresolvedObject;
      return {
        objectId: t.objectId,
        version: t.version ? BigInt(t.version) : t.initialSharedVersion ? BigInt(t.initialSharedVersion) : void 0,
        digest: t.digest ?? void 0,
        mutable: t.mutable ?? void 0
      };
    case "UnresolvedPure":
      throw new Error("UnresolvedPure arguments must be resolved before converting to gRPC format");
    case "FundsWithdrawal": {
      const n = e.FundsWithdrawal;
      return {
        kind: J0.FUNDS_WITHDRAWAL,
        fundsWithdrawal: {
          amount: n.reservation.$kind === "MaxAmountU64" ? BigInt(n.reservation.MaxAmountU64) : void 0,
          coinType: n.typeArg.$kind === "Balance" ? n.typeArg.Balance : void 0,
          source: n.withdrawFrom.$kind === "Sponsor" ? vn.SPONSOR : vn.SENDER
        }
      };
    }
    default:
      throw new Error(`Unknown CallArg kind: ${JSON.stringify(e)}`);
  }
}
function de(e) {
  if ("GasCoin" in e) return { kind: xe.GAS };
  if ("Input" in e) return {
    kind: xe.INPUT,
    input: e.Input
  };
  if ("Result" in e) return {
    kind: xe.RESULT,
    result: e.Result
  };
  if ("NestedResult" in e) return {
    kind: xe.RESULT,
    result: e.NestedResult[0],
    subresult: e.NestedResult[1]
  };
  throw new Error(`Unknown Argument: ${JSON.stringify(e)}`);
}
function Gb(e) {
  switch (e.$kind) {
    case "MoveCall":
      return { command: {
        oneofKind: "moveCall",
        moveCall: {
          package: e.MoveCall.package,
          module: e.MoveCall.module,
          function: e.MoveCall.function,
          typeArguments: e.MoveCall.typeArguments,
          arguments: e.MoveCall.arguments.map(de)
        }
      } };
    case "TransferObjects":
      return { command: {
        oneofKind: "transferObjects",
        transferObjects: {
          objects: e.TransferObjects.objects.map(de),
          address: de(e.TransferObjects.address)
        }
      } };
    case "SplitCoins":
      return { command: {
        oneofKind: "splitCoins",
        splitCoins: {
          coin: de(e.SplitCoins.coin),
          amounts: e.SplitCoins.amounts.map(de)
        }
      } };
    case "MergeCoins":
      return { command: {
        oneofKind: "mergeCoins",
        mergeCoins: {
          coin: de(e.MergeCoins.destination),
          coinsToMerge: e.MergeCoins.sources.map(de)
        }
      } };
    case "Publish":
      return { command: {
        oneofKind: "publish",
        publish: {
          modules: e.Publish.modules.map((t) => j0(t)),
          dependencies: e.Publish.dependencies
        }
      } };
    case "MakeMoveVec":
      return { command: {
        oneofKind: "makeMoveVector",
        makeMoveVector: {
          elementType: e.MakeMoveVec.type ?? void 0,
          elements: e.MakeMoveVec.elements.map(de)
        }
      } };
    case "Upgrade":
      return { command: {
        oneofKind: "upgrade",
        upgrade: {
          modules: e.Upgrade.modules.map((t) => j0(t)),
          dependencies: e.Upgrade.dependencies,
          package: e.Upgrade.package,
          ticket: de(e.Upgrade.ticket)
        }
      } };
    default:
      throw new Error(`Unknown Command kind: ${JSON.stringify(e)}`);
  }
}
function Mo(e) {
  const t = {
    version: 1,
    kind: { data: {
      oneofKind: "programmableTransaction",
      programmableTransaction: {
        inputs: e.inputs.map(zb),
        commands: e.commands.map(Gb)
      }
    } }
  };
  e.sender && (t.sender = e.sender);
  const n = e.gasData.owner ?? e.sender;
  if (t.gasPayment = {
    objects: e.gasData.payment ? e.gasData.payment.map((a) => ({
      objectId: a.objectId,
      version: BigInt(a.version),
      digest: a.digest
    })) : [],
    price: e.gasData.price ? BigInt(e.gasData.price) : void 0,
    budget: e.gasData.budget ? BigInt(e.gasData.budget) : void 0
  }, n && (t.gasPayment.owner = n), e.expiration) {
    if ("None" in e.expiration) t.expiration = { kind: We.NONE };
    else if (e.expiration.$kind === "Epoch") t.expiration = {
      kind: We.EPOCH,
      epoch: BigInt(e.expiration.Epoch)
    };
    else if (e.expiration.$kind === "ValidDuring") {
      const a = e.expiration.ValidDuring;
      t.expiration = {
        kind: We.VALID_DURING,
        minEpoch: a.minEpoch != null ? BigInt(a.minEpoch) : void 0,
        epoch: a.maxEpoch != null ? BigInt(a.maxEpoch) : void 0,
        chain: a.chain,
        nonce: a.nonce
      };
    }
  }
  return t;
}
function Wb(e) {
  const t = e.getData();
  return t.sender || (t.sender = "0x0000000000000000000000000000000000000000000000000000000000000000"), Mo(t);
}
function Qb(e) {
  const t = Wb(e);
  return Ya.toJson(t);
}
function Jb(e) {
  switch (e.kind) {
    case J0.PURE:
      return {
        $kind: "Pure",
        Pure: { bytes: I0(e.pure) }
      };
    case J0.IMMUTABLE_OR_OWNED:
      return {
        $kind: "Object",
        Object: {
          $kind: "ImmOrOwnedObject",
          ImmOrOwnedObject: {
            objectId: e.objectId,
            version: e.version.toString(),
            digest: e.digest
          }
        }
      };
    case J0.SHARED:
      return {
        $kind: "Object",
        Object: {
          $kind: "SharedObject",
          SharedObject: {
            objectId: e.objectId,
            initialSharedVersion: e.version.toString(),
            mutable: e.mutable ?? !1
          }
        }
      };
    case J0.RECEIVING:
      return {
        $kind: "Object",
        Object: {
          $kind: "Receiving",
          Receiving: {
            objectId: e.objectId,
            version: e.version.toString(),
            digest: e.digest
          }
        }
      };
    case J0.FUNDS_WITHDRAWAL:
      return {
        $kind: "FundsWithdrawal",
        FundsWithdrawal: {
          reservation: {
            $kind: "MaxAmountU64",
            MaxAmountU64: e.fundsWithdrawal?.amount?.toString() ?? "0"
          },
          typeArg: {
            $kind: "Balance",
            Balance: e.fundsWithdrawal?.coinType ?? "0x2::sui::SUI"
          },
          withdrawFrom: e.fundsWithdrawal?.source === vn.SPONSOR ? {
            $kind: "Sponsor",
            Sponsor: !0
          } : {
            $kind: "Sender",
            Sender: !0
          }
        }
      };
    default:
      throw new Error(`Unknown Input kind: ${JSON.stringify(e)}`);
  }
}
function fe(e) {
  switch (e.kind) {
    case xe.GAS:
      return {
        $kind: "GasCoin",
        GasCoin: !0
      };
    case xe.INPUT:
      return {
        $kind: "Input",
        Input: e.input
      };
    case xe.RESULT:
      return e.subresult != null ? {
        $kind: "NestedResult",
        NestedResult: [e.result, e.subresult]
      } : {
        $kind: "Result",
        Result: e.result
      };
    default:
      throw new Error(`Unknown Argument kind: ${JSON.stringify(e)}`);
  }
}
function Yb(e) {
  const t = e.command;
  if (!t) throw new Error("Command is missing");
  switch (t.oneofKind) {
    case "moveCall":
      return {
        $kind: "MoveCall",
        MoveCall: {
          package: t.moveCall.package,
          module: t.moveCall.module,
          function: t.moveCall.function,
          typeArguments: t.moveCall.typeArguments ?? [],
          arguments: t.moveCall.arguments.map(fe)
        }
      };
    case "transferObjects":
      return {
        $kind: "TransferObjects",
        TransferObjects: {
          objects: t.transferObjects.objects.map(fe),
          address: fe(t.transferObjects.address)
        }
      };
    case "splitCoins":
      return {
        $kind: "SplitCoins",
        SplitCoins: {
          coin: fe(t.splitCoins.coin),
          amounts: t.splitCoins.amounts.map(fe)
        }
      };
    case "mergeCoins":
      return {
        $kind: "MergeCoins",
        MergeCoins: {
          destination: fe(t.mergeCoins.coin),
          sources: t.mergeCoins.coinsToMerge.map(fe)
        }
      };
    case "publish":
      return {
        $kind: "Publish",
        Publish: {
          modules: t.publish.modules.map((n) => I0(n)),
          dependencies: t.publish.dependencies ?? []
        }
      };
    case "makeMoveVector":
      return {
        $kind: "MakeMoveVec",
        MakeMoveVec: {
          type: t.makeMoveVector.elementType ?? null,
          elements: t.makeMoveVector.elements.map(fe)
        }
      };
    case "upgrade":
      return {
        $kind: "Upgrade",
        Upgrade: {
          modules: t.upgrade.modules.map((n) => I0(n)),
          dependencies: t.upgrade.dependencies ?? [],
          package: t.upgrade.package,
          ticket: fe(t.upgrade.ticket)
        }
      };
    default:
      throw new Error(`Unknown Command kind: ${JSON.stringify(t)}`);
  }
}
function Zb(e) {
  const t = e.kind?.data;
  if (t?.oneofKind !== "programmableTransaction") throw new Error("Only programmable transactions are supported");
  const n = t.programmableTransaction.inputs.map(Jb), a = t.programmableTransaction.commands.map(Yb);
  let s = null;
  if (e.expiration) switch (e.expiration.kind) {
    case We.NONE:
      s = {
        $kind: "None",
        None: !0
      };
      break;
    case We.EPOCH:
      s = {
        $kind: "Epoch",
        Epoch: e.expiration.epoch.toString()
      };
      break;
    case We.VALID_DURING:
      s = {
        $kind: "ValidDuring",
        ValidDuring: {
          minEpoch: e.expiration.minEpoch?.toString() ?? null,
          maxEpoch: e.expiration.epoch?.toString() ?? null,
          minTimestamp: null,
          maxTimestamp: null,
          chain: e.expiration.chain ?? "",
          nonce: e.expiration.nonce ?? 0
        }
      };
      break;
  }
  return {
    version: 2,
    sender: e.sender ?? null,
    expiration: s,
    gasData: {
      budget: e.gasPayment?.budget?.toString() ?? null,
      owner: e.gasPayment?.owner ?? null,
      payment: e.gasPayment?.objects?.map((r) => ({
        objectId: r.objectId,
        version: r.version.toString(),
        digest: r.digest
      })) ?? null,
      price: e.gasPayment?.price?.toString() ?? null
    },
    inputs: n,
    commands: a
  };
}
async function qb({ transactionData: e, client: t, epoch: n, originalTransactionData: a, isTransactionKindOnly: s, doGasSelection: r }) {
  if (s || r || a.expiration || a.gasData.payment?.length !== 0 || e.expiration && e.expiration.$kind !== "None") return;
  const [{ chainIdentifier: i }, o] = await Promise.all([t.core.getChainIdentifier(), n == null ? t.core.getCurrentSystemState() : null]), c = BigInt(n ?? o.systemState.epoch);
  e.expiration = {
    $kind: "ValidDuring",
    ValidDuring: {
      minEpoch: String(c),
      maxEpoch: String(c + 1n),
      minTimestamp: null,
      maxTimestamp: null,
      chain: i,
      nonce: Math.random() * 4294967296 >>> 0
    }
  };
}
var Hb = class extends O {
  constructor() {
    super("sui.rpc.v2.BalanceChange", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "coin_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "amount",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const Xb = new Hb();
var Kb = class extends O {
  constructor() {
    super("sui.rpc.v2.GasCostSummary", [
      {
        no: 1,
        name: "computation_cost",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "storage_cost",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "storage_rebate",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "non_refundable_storage_fee",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const e2 = new Kb();
let t2 = /* @__PURE__ */ function(e) {
  return e[e.EXECUTION_ERROR_KIND_UNKNOWN = 0] = "EXECUTION_ERROR_KIND_UNKNOWN", e[e.INSUFFICIENT_GAS = 1] = "INSUFFICIENT_GAS", e[e.INVALID_GAS_OBJECT = 2] = "INVALID_GAS_OBJECT", e[e.INVARIANT_VIOLATION = 3] = "INVARIANT_VIOLATION", e[e.FEATURE_NOT_YET_SUPPORTED = 4] = "FEATURE_NOT_YET_SUPPORTED", e[e.OBJECT_TOO_BIG = 5] = "OBJECT_TOO_BIG", e[e.PACKAGE_TOO_BIG = 6] = "PACKAGE_TOO_BIG", e[e.CIRCULAR_OBJECT_OWNERSHIP = 7] = "CIRCULAR_OBJECT_OWNERSHIP", e[e.INSUFFICIENT_COIN_BALANCE = 8] = "INSUFFICIENT_COIN_BALANCE", e[e.COIN_BALANCE_OVERFLOW = 9] = "COIN_BALANCE_OVERFLOW", e[e.PUBLISH_ERROR_NON_ZERO_ADDRESS = 10] = "PUBLISH_ERROR_NON_ZERO_ADDRESS", e[e.SUI_MOVE_VERIFICATION_ERROR = 11] = "SUI_MOVE_VERIFICATION_ERROR", e[e.MOVE_PRIMITIVE_RUNTIME_ERROR = 12] = "MOVE_PRIMITIVE_RUNTIME_ERROR", e[e.MOVE_ABORT = 13] = "MOVE_ABORT", e[e.VM_VERIFICATION_OR_DESERIALIZATION_ERROR = 14] = "VM_VERIFICATION_OR_DESERIALIZATION_ERROR", e[e.VM_INVARIANT_VIOLATION = 15] = "VM_INVARIANT_VIOLATION", e[e.FUNCTION_NOT_FOUND = 16] = "FUNCTION_NOT_FOUND", e[e.ARITY_MISMATCH = 17] = "ARITY_MISMATCH", e[e.TYPE_ARITY_MISMATCH = 18] = "TYPE_ARITY_MISMATCH", e[e.NON_ENTRY_FUNCTION_INVOKED = 19] = "NON_ENTRY_FUNCTION_INVOKED", e[e.COMMAND_ARGUMENT_ERROR = 20] = "COMMAND_ARGUMENT_ERROR", e[e.TYPE_ARGUMENT_ERROR = 21] = "TYPE_ARGUMENT_ERROR", e[e.UNUSED_VALUE_WITHOUT_DROP = 22] = "UNUSED_VALUE_WITHOUT_DROP", e[e.INVALID_PUBLIC_FUNCTION_RETURN_TYPE = 23] = "INVALID_PUBLIC_FUNCTION_RETURN_TYPE", e[e.INVALID_TRANSFER_OBJECT = 24] = "INVALID_TRANSFER_OBJECT", e[e.EFFECTS_TOO_LARGE = 25] = "EFFECTS_TOO_LARGE", e[e.PUBLISH_UPGRADE_MISSING_DEPENDENCY = 26] = "PUBLISH_UPGRADE_MISSING_DEPENDENCY", e[e.PUBLISH_UPGRADE_DEPENDENCY_DOWNGRADE = 27] = "PUBLISH_UPGRADE_DEPENDENCY_DOWNGRADE", e[e.PACKAGE_UPGRADE_ERROR = 28] = "PACKAGE_UPGRADE_ERROR", e[e.WRITTEN_OBJECTS_TOO_LARGE = 29] = "WRITTEN_OBJECTS_TOO_LARGE", e[e.CERTIFICATE_DENIED = 30] = "CERTIFICATE_DENIED", e[e.SUI_MOVE_VERIFICATION_TIMEDOUT = 31] = "SUI_MOVE_VERIFICATION_TIMEDOUT", e[e.CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED = 32] = "CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED", e[e.INPUT_OBJECT_DELETED = 33] = "INPUT_OBJECT_DELETED", e[e.EXECUTION_CANCELED_DUE_TO_CONSENSUS_OBJECT_CONGESTION = 34] = "EXECUTION_CANCELED_DUE_TO_CONSENSUS_OBJECT_CONGESTION", e[e.ADDRESS_DENIED_FOR_COIN = 35] = "ADDRESS_DENIED_FOR_COIN", e[e.COIN_TYPE_GLOBAL_PAUSE = 36] = "COIN_TYPE_GLOBAL_PAUSE", e[e.EXECUTION_CANCELED_DUE_TO_RANDOMNESS_UNAVAILABLE = 37] = "EXECUTION_CANCELED_DUE_TO_RANDOMNESS_UNAVAILABLE", e[e.MOVE_VECTOR_ELEM_TOO_BIG = 38] = "MOVE_VECTOR_ELEM_TOO_BIG", e[e.MOVE_RAW_VALUE_TOO_BIG = 39] = "MOVE_RAW_VALUE_TOO_BIG", e[e.INVALID_LINKAGE = 40] = "INVALID_LINKAGE", e[e.INSUFFICIENT_FUNDS_FOR_WITHDRAW = 41] = "INSUFFICIENT_FUNDS_FOR_WITHDRAW", e[e.NON_EXCLUSIVE_WRITE_INPUT_OBJECT_MODIFIED = 42] = "NON_EXCLUSIVE_WRITE_INPUT_OBJECT_MODIFIED", e;
}({}), n2 = /* @__PURE__ */ function(e) {
  return e[e.COMMAND_ARGUMENT_ERROR_KIND_UNKNOWN = 0] = "COMMAND_ARGUMENT_ERROR_KIND_UNKNOWN", e[e.TYPE_MISMATCH = 1] = "TYPE_MISMATCH", e[e.INVALID_BCS_BYTES = 2] = "INVALID_BCS_BYTES", e[e.INVALID_USAGE_OF_PURE_ARGUMENT = 3] = "INVALID_USAGE_OF_PURE_ARGUMENT", e[e.INVALID_ARGUMENT_TO_PRIVATE_ENTRY_FUNCTION = 4] = "INVALID_ARGUMENT_TO_PRIVATE_ENTRY_FUNCTION", e[e.INDEX_OUT_OF_BOUNDS = 5] = "INDEX_OUT_OF_BOUNDS", e[e.SECONDARY_INDEX_OUT_OF_BOUNDS = 6] = "SECONDARY_INDEX_OUT_OF_BOUNDS", e[e.INVALID_RESULT_ARITY = 7] = "INVALID_RESULT_ARITY", e[e.INVALID_GAS_COIN_USAGE = 8] = "INVALID_GAS_COIN_USAGE", e[e.INVALID_VALUE_USAGE = 9] = "INVALID_VALUE_USAGE", e[e.INVALID_OBJECT_BY_VALUE = 10] = "INVALID_OBJECT_BY_VALUE", e[e.INVALID_OBJECT_BY_MUT_REF = 11] = "INVALID_OBJECT_BY_MUT_REF", e[e.CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED = 12] = "CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED", e[e.INVALID_ARGUMENT_ARITY = 13] = "INVALID_ARGUMENT_ARITY", e[e.INVALID_TRANSFER_OBJECT = 14] = "INVALID_TRANSFER_OBJECT", e[e.INVALID_MAKE_MOVE_VEC_NON_OBJECT_ARGUMENT = 15] = "INVALID_MAKE_MOVE_VEC_NON_OBJECT_ARGUMENT", e[e.ARGUMENT_WITHOUT_VALUE = 16] = "ARGUMENT_WITHOUT_VALUE", e[e.CANNOT_MOVE_BORROWED_VALUE = 17] = "CANNOT_MOVE_BORROWED_VALUE", e[e.CANNOT_WRITE_TO_EXTENDED_REFERENCE = 18] = "CANNOT_WRITE_TO_EXTENDED_REFERENCE", e[e.INVALID_REFERENCE_ARGUMENT = 19] = "INVALID_REFERENCE_ARGUMENT", e;
}({}), a2 = /* @__PURE__ */ function(e) {
  return e[e.PACKAGE_UPGRADE_ERROR_KIND_UNKNOWN = 0] = "PACKAGE_UPGRADE_ERROR_KIND_UNKNOWN", e[e.UNABLE_TO_FETCH_PACKAGE = 1] = "UNABLE_TO_FETCH_PACKAGE", e[e.NOT_A_PACKAGE = 2] = "NOT_A_PACKAGE", e[e.INCOMPATIBLE_UPGRADE = 3] = "INCOMPATIBLE_UPGRADE", e[e.DIGEST_DOES_NOT_MATCH = 4] = "DIGEST_DOES_NOT_MATCH", e[e.UNKNOWN_UPGRADE_POLICY = 5] = "UNKNOWN_UPGRADE_POLICY", e[e.PACKAGE_ID_DOES_NOT_MATCH = 6] = "PACKAGE_ID_DOES_NOT_MATCH", e;
}({}), s2 = /* @__PURE__ */ function(e) {
  return e[e.TYPE_ARGUMENT_ERROR_KIND_UNKNOWN = 0] = "TYPE_ARGUMENT_ERROR_KIND_UNKNOWN", e[e.TYPE_NOT_FOUND = 1] = "TYPE_NOT_FOUND", e[e.CONSTRAINT_NOT_SATISFIED = 2] = "CONSTRAINT_NOT_SATISFIED", e;
}({});
var r2 = class extends O {
  constructor() {
    super("sui.rpc.v2.ExecutionStatus", [{
      no: 1,
      name: "success",
      kind: "scalar",
      opt: !0,
      T: 8
    }, {
      no: 2,
      name: "error",
      kind: "message",
      T: () => c2
    }]);
  }
};
const i2 = new r2();
var o2 = class extends O {
  constructor() {
    super("sui.rpc.v2.ExecutionError", [
      {
        no: 1,
        name: "description",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "command",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.ExecutionError.ExecutionErrorKind", t2]
      },
      {
        no: 4,
        name: "abort",
        kind: "message",
        oneof: "errorDetails",
        T: () => f2
      },
      {
        no: 5,
        name: "size_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => g2
      },
      {
        no: 6,
        name: "command_argument_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => I2
      },
      {
        no: 7,
        name: "type_argument_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => k2
      },
      {
        no: 8,
        name: "package_upgrade_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => E2
      },
      {
        no: 9,
        name: "index_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => Ro
      },
      {
        no: 10,
        name: "object_id",
        kind: "scalar",
        oneof: "errorDetails",
        T: 9
      },
      {
        no: 11,
        name: "coin_deny_list_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => y2
      },
      {
        no: 12,
        name: "congested_objects",
        kind: "message",
        oneof: "errorDetails",
        T: () => v2
      }
    ]);
  }
};
const c2 = new o2();
var d2 = class extends O {
  constructor() {
    super("sui.rpc.v2.MoveAbort", [
      {
        no: 1,
        name: "abort_code",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "location",
        kind: "message",
        T: () => l2
      },
      {
        no: 3,
        name: "clever_error",
        kind: "message",
        T: () => p2
      }
    ]);
  }
};
const f2 = new d2();
var u2 = class extends O {
  constructor() {
    super("sui.rpc.v2.MoveLocation", [
      {
        no: 1,
        name: "package",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "module",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "function",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 4,
        name: "instruction",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 5,
        name: "function_name",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const l2 = new u2();
var b2 = class extends O {
  constructor() {
    super("sui.rpc.v2.CleverError", [
      {
        no: 1,
        name: "error_code",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "line_number",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "constant_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "constant_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "rendered",
        kind: "scalar",
        oneof: "value",
        T: 9
      },
      {
        no: 6,
        name: "raw",
        kind: "scalar",
        oneof: "value",
        T: 12
      }
    ]);
  }
};
const p2 = new b2();
var m2 = class extends O {
  constructor() {
    super("sui.rpc.v2.SizeError", [{
      no: 1,
      name: "size",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }, {
      no: 2,
      name: "max_size",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }]);
  }
};
const g2 = new m2();
var h2 = class extends O {
  constructor() {
    super("sui.rpc.v2.IndexError", [{
      no: 1,
      name: "index",
      kind: "scalar",
      opt: !0,
      T: 13
    }, {
      no: 2,
      name: "subresult",
      kind: "scalar",
      opt: !0,
      T: 13
    }]);
  }
};
const Ro = new h2();
var A2 = class extends O {
  constructor() {
    super("sui.rpc.v2.CoinDenyListError", [{
      no: 1,
      name: "address",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "coin_type",
      kind: "scalar",
      opt: !0,
      T: 9
    }]);
  }
};
const y2 = new A2();
var w2 = class extends O {
  constructor() {
    super("sui.rpc.v2.CongestedObjects", [{
      no: 1,
      name: "objects",
      kind: "scalar",
      repeat: 2,
      T: 9
    }]);
  }
};
const v2 = new w2();
var T2 = class extends O {
  constructor() {
    super("sui.rpc.v2.CommandArgumentError", [
      {
        no: 1,
        name: "argument",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 2,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.CommandArgumentError.CommandArgumentErrorKind", n2]
      },
      {
        no: 3,
        name: "index_error",
        kind: "message",
        T: () => Ro
      }
    ]);
  }
};
const I2 = new T2();
var O2 = class extends O {
  constructor() {
    super("sui.rpc.v2.PackageUpgradeError", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.PackageUpgradeError.PackageUpgradeErrorKind", a2]
      },
      {
        no: 2,
        name: "package_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "policy",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 5,
        name: "ticket_id",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const E2 = new O2();
var S2 = class extends O {
  constructor() {
    super("sui.rpc.v2.TypeArgumentError", [{
      no: 1,
      name: "type_argument",
      kind: "scalar",
      opt: !0,
      T: 13
    }, {
      no: 2,
      name: "kind",
      kind: "enum",
      opt: !0,
      T: () => ["sui.rpc.v2.TypeArgumentError.TypeArgumentErrorKind", s2]
    }]);
  }
};
const k2 = new S2();
let N2 = /* @__PURE__ */ function(e) {
  return e[e.UNKNOWN = 0] = "UNKNOWN", e[e.DOES_NOT_EXIST = 1] = "DOES_NOT_EXIST", e[e.EXISTS = 2] = "EXISTS", e;
}({}), C2 = /* @__PURE__ */ function(e) {
  return e[e.UNKNOWN = 0] = "UNKNOWN", e[e.DOES_NOT_EXIST = 1] = "DOES_NOT_EXIST", e[e.OBJECT_WRITE = 2] = "OBJECT_WRITE", e[e.PACKAGE_WRITE = 3] = "PACKAGE_WRITE", e[e.ACCUMULATOR_WRITE = 4] = "ACCUMULATOR_WRITE", e;
}({}), x2 = /* @__PURE__ */ function(e) {
  return e[e.ID_OPERATION_UNKNOWN = 0] = "ID_OPERATION_UNKNOWN", e[e.NONE = 1] = "NONE", e[e.CREATED = 2] = "CREATED", e[e.DELETED = 3] = "DELETED", e;
}({}), _2 = /* @__PURE__ */ function(e) {
  return e[e.ACCUMULATOR_OPERATION_UNKNOWN = 0] = "ACCUMULATOR_OPERATION_UNKNOWN", e[e.MERGE = 1] = "MERGE", e[e.SPLIT = 2] = "SPLIT", e;
}({}), B2 = /* @__PURE__ */ function(e) {
  return e[e.ACCUMULATOR_VALUE_UNKNOWN = 0] = "ACCUMULATOR_VALUE_UNKNOWN", e[e.INTEGER = 1] = "INTEGER", e[e.INTEGER_TUPLE = 2] = "INTEGER_TUPLE", e[e.EVENT_DIGEST = 3] = "EVENT_DIGEST", e;
}({}), j2 = /* @__PURE__ */ function(e) {
  return e[e.UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN = 0] = "UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN", e[e.READ_ONLY_ROOT = 1] = "READ_ONLY_ROOT", e[e.MUTATE_CONSENSUS_STREAM_ENDED = 2] = "MUTATE_CONSENSUS_STREAM_ENDED", e[e.READ_CONSENSUS_STREAM_ENDED = 3] = "READ_CONSENSUS_STREAM_ENDED", e[e.CANCELED = 4] = "CANCELED", e[e.PER_EPOCH_CONFIG = 5] = "PER_EPOCH_CONFIG", e;
}({});
var M2 = class extends O {
  constructor() {
    super("sui.rpc.v2.TransactionEffects", [
      {
        no: 1,
        name: "bcs",
        kind: "message",
        T: () => wn
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 5
      },
      {
        no: 4,
        name: "status",
        kind: "message",
        T: () => i2
      },
      {
        no: 5,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "gas_used",
        kind: "message",
        T: () => e2
      },
      {
        no: 7,
        name: "transaction_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 8,
        name: "gas_object",
        kind: "message",
        T: () => er
      },
      {
        no: 9,
        name: "events_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 10,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 11,
        name: "lamport_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 12,
        name: "changed_objects",
        kind: "message",
        repeat: 2,
        T: () => er
      },
      {
        no: 13,
        name: "unchanged_consensus_objects",
        kind: "message",
        repeat: 2,
        T: () => L2
      },
      {
        no: 14,
        name: "auxiliary_data_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 15,
        name: "unchanged_loaded_runtime_objects",
        kind: "message",
        repeat: 2,
        T: () => _o
      }
    ]);
  }
};
const R2 = new M2();
var D2 = class extends O {
  constructor() {
    super("sui.rpc.v2.ChangedObject", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "input_state",
        kind: "enum",
        opt: !0,
        T: () => [
          "sui.rpc.v2.ChangedObject.InputObjectState",
          N2,
          "INPUT_OBJECT_STATE_"
        ]
      },
      {
        no: 3,
        name: "input_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "input_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "input_owner",
        kind: "message",
        T: () => Ia
      },
      {
        no: 6,
        name: "output_state",
        kind: "enum",
        opt: !0,
        T: () => [
          "sui.rpc.v2.ChangedObject.OutputObjectState",
          C2,
          "OUTPUT_OBJECT_STATE_"
        ]
      },
      {
        no: 7,
        name: "output_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 8,
        name: "output_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 9,
        name: "output_owner",
        kind: "message",
        T: () => Ia
      },
      {
        no: 12,
        name: "accumulator_write",
        kind: "message",
        T: () => F2
      },
      {
        no: 10,
        name: "id_operation",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.ChangedObject.IdOperation", x2]
      },
      {
        no: 11,
        name: "object_type",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const er = new D2();
var U2 = class extends O {
  constructor() {
    super("sui.rpc.v2.EventDigestEntry", [{
      no: 1,
      name: "event_index",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }, {
      no: 2,
      name: "digest",
      kind: "scalar",
      opt: !0,
      T: 9
    }]);
  }
};
const P2 = new U2();
var V2 = class extends O {
  constructor() {
    super("sui.rpc.v2.AccumulatorWrite", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "accumulator_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "operation",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.AccumulatorWrite.AccumulatorOperation", _2]
      },
      {
        no: 4,
        name: "value_kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.AccumulatorWrite.AccumulatorValue", B2]
      },
      {
        no: 5,
        name: "integer_value",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "integer_tuple",
        kind: "scalar",
        repeat: 1,
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "event_digest_value",
        kind: "message",
        repeat: 2,
        T: () => P2
      }
    ]);
  }
};
const F2 = new V2();
var $2 = class extends O {
  constructor() {
    super("sui.rpc.v2.UnchangedConsensusObject", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.UnchangedConsensusObject.UnchangedConsensusObjectKind", j2]
      },
      {
        no: 2,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "object_type",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const L2 = new $2(), z2 = 50;
function tr(e) {
  if (e.after != null && e.before != null) throw new Error("Only one of `after` or `before` may be provided");
  const t = e.order ? e.order === "descending" : e.before != null;
  if (e.after != null && t) throw new Error("`after` can not be combined with descending queries");
  if (e.before != null && !t) throw new Error("`before` can not be combined with ascending queries");
  return {
    descending: t,
    after: e.after ?? void 0,
    before: e.before ?? void 0,
    limit: e.limit ?? z2
  };
}
function G2(e, t) {
  if (e?.$kind === "function" && (t.after != null || t.before != null) && (!e.module || !e.function)) throw new Error("Paginating transactions filtered by function requires a fully qualified `package::module::function`");
}
async function W2(e, t, n) {
  if (Do(t, ["sender", "function"], "transaction"), t.sender != null) return {
    $kind: "sender",
    sender: j(t.sender)
  };
  const [a, s, r, ...i] = t.function.split("::");
  if (!a || i.length > 0 || s === "" || r === "") throw new Error(`Invalid function filter "${t.function}": expected "package", "package::module", or "package::module::function"`);
  return {
    $kind: "function",
    package: j((await e.resolvePackage({
      package: a,
      signal: n
    })).package),
    module: s,
    function: r
  };
}
async function Q2(e, t, n) {
  if (Do(t, [
    "sender",
    "emitModule",
    "eventType"
  ], "event"), t.sender != null) return {
    $kind: "sender",
    sender: j(t.sender)
  };
  if (t.emitModule != null) {
    const [r, i, ...o] = t.emitModule.split("::");
    if (!r || !i || o.length > 0) throw new Error(`Invalid emitModule filter "${t.emitModule}": expected "package::module"`);
    return {
      $kind: "emitModule",
      package: j((await e.resolvePackage({
        package: r,
        signal: n
      })).package),
      module: i
    };
  }
  const a = t.eventType, s = a.split("::");
  if (s.length === 2 && s.every((r) => r !== "")) return {
    $kind: "eventTypeModule",
    package: j((await e.resolvePackage({
      package: s[0],
      signal: n
    })).package),
    module: s[1]
  };
  if (s.length < 3 || s.some((r) => r === "")) throw new Error(`Invalid eventType filter "${a}": expected "package::module" or a fully qualified type name`);
  return {
    $kind: "eventType",
    eventType: (await e.resolveType({
      type: a,
      signal: n
    })).type
  };
}
function Do(e, t, n) {
  const a = t.filter((s) => e[s] != null);
  if (a.length !== 1) throw new Error(`A ${n} filter must specify exactly one of ${t.join(", ")}${a.length ? ` (got ${a.join(", ")})` : ""}`);
}
var J2 = class extends uu {
  #n;
  constructor({ graphqlClient: e, mvr: t }) {
    super({
      network: e.network,
      base: e,
      mvr: t
    }), this.#n = e;
  }
  async #e(e, t, n) {
    const { data: a, errors: s } = await this.#n.query(e);
    Wt(s);
    const r = a && (t ? t(a) : a);
    if (r == null) throw n?.() ?? /* @__PURE__ */ new Error("Missing response data");
    return r;
  }
  async getObjects(e) {
    const t = bn(e.objectIds, 50), n = [];
    for (const a of t) {
      const s = await this.#e({
        query: au,
        signal: e.signal,
        variables: {
          objectKeys: a.map((r) => ({ address: r })),
          includeContent: e.include?.content ?? !1,
          includePreviousTransaction: e.include?.previousTransaction ?? !1,
          includeObjectBcs: e.include?.objectBcs ?? !1,
          includeJson: e.include?.json ?? !1,
          includeDisplay: e.include?.display ?? !1
        }
      }, (r) => r.multiGetObjects);
      n.push(...a.map((r) => ({
        objectId: r,
        normalized: j(r)
      })).map(({ objectId: r, normalized: i }) => s.find((o) => o?.address === i) ?? new Ms("notFound", `Object ${i} not found`, {
        reason: "notFound",
        objectId: r
      })).map((r) => {
        if (r instanceof Ms) return r;
        const i = r.asMoveObject?.contents?.bcs ? w0(r.asMoveObject.contents.bcs) : void 0, o = r.objectBcs ? w0(r.objectBcs) : void 0;
        let c;
        r.asMovePackage ? c = "package" : r.asMoveObject?.contents?.type?.repr ? c = r.asMoveObject.contents.type.repr : c = "";
        const u = e.include?.json ? r.asMoveObject?.contents?.json ? r.asMoveObject.contents.json : null : void 0, f = nr(e.include?.display, r.asMoveObject?.contents?.display);
        return {
          objectId: r.address,
          version: r.version?.toString(),
          digest: r.digest,
          owner: Kn(r.owner),
          type: c,
          content: i,
          previousTransaction: r.previousTransaction?.digest ?? void 0,
          objectBcs: o,
          json: u,
          display: f
        };
      }));
    }
    return { objects: n };
  }
  async listOwnedObjects(e) {
    const t = await this.#e({
      query: nu,
      signal: e.signal,
      variables: {
        owner: e.owner,
        limit: e.limit,
        cursor: e.cursor,
        filter: e.type ? { type: (await this.mvr.resolveType({
          type: e.type,
          signal: e.signal
        })).type } : void 0,
        includeContent: e.include?.content ?? !1,
        includePreviousTransaction: e.include?.previousTransaction ?? !1,
        includeObjectBcs: e.include?.objectBcs ?? !1,
        includeJson: e.include?.json ?? !1,
        includeDisplay: e.include?.display ?? !1
      }
    }, (n) => n.address?.objects);
    return {
      objects: t.nodes.map((n) => ({
        objectId: n.address,
        version: n.version?.toString(),
        digest: n.digest,
        owner: Kn(n.owner),
        type: n.contents?.type?.repr,
        content: n.contents?.bcs ? w0(n.contents.bcs) : void 0,
        previousTransaction: n.previousTransaction?.digest ?? void 0,
        objectBcs: n.objectBcs ? w0(n.objectBcs) : void 0,
        json: e.include?.json ? n.contents?.json ? n.contents.json : null : void 0,
        display: nr(e.include?.display, n.contents?.display)
      })),
      hasNextPage: t.pageInfo.hasNextPage,
      cursor: t.pageInfo.endCursor ?? null
    };
  }
  async listCoins(e) {
    const t = e.coinType ?? ln, n = await this.#e({
      query: J5,
      signal: e.signal,
      variables: {
        owner: e.owner,
        cursor: e.cursor,
        first: e.limit,
        type: `0x2::coin::Coin<${(await this.mvr.resolveType({
          type: t,
          signal: e.signal
        })).type}>`
      }
    }, (a) => a.address?.objects);
    return {
      cursor: n.pageInfo.endCursor ?? null,
      hasNextPage: n.pageInfo.hasNextPage,
      objects: n.nodes.map((a) => ({
        objectId: a.address,
        version: a.version?.toString(),
        digest: a.digest,
        owner: Kn(a.owner),
        type: a.contents?.type?.repr,
        balance: a.contents?.json?.balance
      }))
    };
  }
  async getBalance(e) {
    const t = e.coinType ?? ln, n = await this.#e({
      query: G5,
      signal: e.signal,
      variables: {
        owner: e.owner,
        coinType: (await this.mvr.resolveType({
          type: t,
          signal: e.signal
        })).type
      }
    }, (r) => r.address?.balance), a = BigInt(n.addressBalance ?? "0"), s = BigInt(n.totalBalance ?? "0") - a;
    return { balance: {
      coinType: n.coinType?.repr ?? t,
      balance: n.totalBalance ?? "0",
      coinBalance: s.toString(),
      addressBalance: a.toString()
    } };
  }
  async getCoinMetadata(e) {
    const t = (await this.mvr.resolveType({
      type: e.coinType,
      signal: e.signal
    })).type, { data: n, errors: a } = await this.#n.query({
      query: Q5,
      signal: e.signal,
      variables: { coinType: t }
    });
    return Wt(a), n?.coinMetadata ? { coinMetadata: {
      id: n.coinMetadata.address,
      decimals: n.coinMetadata.decimals,
      name: n.coinMetadata.name,
      symbol: n.coinMetadata.symbol,
      description: n.coinMetadata.description,
      iconUrl: n.coinMetadata.iconUrl ?? null
    } } : { coinMetadata: null };
  }
  async listBalances(e) {
    const t = await this.#e({
      query: z5,
      signal: e.signal,
      variables: {
        owner: e.owner,
        limit: e.limit,
        cursor: e.cursor
      }
    }, (n) => n.address?.balances);
    return {
      cursor: t.pageInfo.endCursor ?? null,
      hasNextPage: t.pageInfo.hasNextPage,
      balances: t.nodes.map((n) => {
        const a = BigInt(n.addressBalance ?? "0"), s = BigInt(n.totalBalance ?? "0") - a;
        return {
          coinType: n.coinType?.repr,
          balance: n.totalBalance,
          coinBalance: s.toString(),
          addressBalance: a.toString()
        };
      })
    };
  }
  async getTransaction(e) {
    return Qt(await this.#e({
      query: iu,
      signal: e.signal,
      variables: {
        digest: e.digest,
        includeTransaction: e.include?.transaction ?? !1,
        includeEffects: e.include?.effects ?? !1,
        includeEvents: e.include?.events ?? !1,
        includeBalanceChanges: e.include?.balanceChanges ?? !1,
        includeObjectTypes: e.include?.objectTypes ?? !1,
        includeBcs: e.include?.bcs ?? !1
      }
    }, (t) => t.transaction, () => new K6("notFound", e.digest)), e.include);
  }
  async executeTransaction(e) {
    return Qt((await this.#e({
      query: ru,
      signal: e.signal,
      variables: {
        transactionDataBcs: ya(e.transaction),
        signatures: e.signatures,
        includeTransaction: e.include?.transaction ?? !1,
        includeEffects: e.include?.effects ?? !1,
        includeEvents: e.include?.events ?? !1,
        includeBalanceChanges: e.include?.balanceChanges ?? !1,
        includeObjectTypes: e.include?.objectTypes ?? !1,
        includeBcs: e.include?.bcs ?? !1
      }
    }, (t) => t.executeTransaction)).effects?.transaction, e.include);
  }
  async simulateTransaction(e) {
    e.transaction instanceof Uint8Array || await e.transaction.prepareForSerialization({ client: this });
    const t = e.doGasSelection ?? (e.transaction instanceof Uint8Array ? hu(e.transaction) : e.transaction.getData().gasData.payment?.length === 0), n = await this.#e({
      query: su,
      signal: e.signal,
      variables: {
        transaction: e.transaction instanceof Uint8Array ? { bcs: { value: ya(e.transaction) } } : Qb(e.transaction),
        includeTransaction: e.include?.transaction ?? !1,
        includeEffects: e.include?.effects ?? !1,
        includeEvents: e.include?.events ?? !1,
        includeBalanceChanges: e.include?.balanceChanges ?? !1,
        includeObjectTypes: e.include?.objectTypes ?? !1,
        includeCommandResults: e.include?.commandResults ?? !1,
        includeBcs: e.include?.bcs ?? !1,
        doGasSelection: t,
        checksEnabled: e.checksEnabled ?? !0
      }
    }, (r) => r.simulateTransaction), a = Qt(n.effects?.transaction, e.include), s = e.include?.commandResults && n.outputs ? n.outputs.map((r) => ({
      returnValues: (r.returnValues ?? []).map((i) => ({ bcs: i.value?.bcs ? w0(i.value.bcs) : null })),
      mutatedReferences: (r.mutatedReferences ?? []).map((i) => ({ bcs: i.value?.bcs ? w0(i.value.bcs) : null }))
    })) : void 0;
    return a.$kind === "Transaction" ? {
      $kind: "Transaction",
      Transaction: a.Transaction,
      commandResults: s
    } : {
      $kind: "FailedTransaction",
      FailedTransaction: a.FailedTransaction,
      commandResults: s
    };
  }
  async getReferenceGasPrice(e) {
    return { referenceGasPrice: await this.#e({
      query: X5,
      signal: e?.signal
    }, (t) => t.epoch?.referenceGasPrice) ?? "" };
  }
  async getProtocolConfig(e) {
    const t = await this.#e({
      query: H5,
      signal: e?.signal
    }, (s) => s.epoch?.protocolConfigs), n = {};
    for (const s of t?.featureFlags ?? []) n[s.key] = s.value;
    const a = {};
    for (const s of t?.configs ?? []) a[s.key] = s.value ?? null;
    return { protocolConfig: {
      protocolVersion: t?.protocolVersion?.toString() ?? null,
      featureFlags: n,
      attributes: a
    } };
  }
  async getCurrentSystemState(e) {
    const t = await this.#e({
      query: Y5,
      signal: e?.signal
    }, (s) => s.epoch);
    if (!t) throw new Error("Epoch data not found in response");
    const n = t.startTimestamp ? new Date(t.startTimestamp).getTime().toString() : null, a = t.systemState?.json;
    return { systemState: {
      systemStateVersion: a?.system_state_version?.toString() ?? null,
      epoch: t.epochId?.toString() ?? null,
      protocolVersion: t.protocolConfigs?.protocolVersion?.toString() ?? null,
      referenceGasPrice: t.referenceGasPrice ?? null,
      epochStartTimestampMs: n,
      safeMode: a?.safe_mode ?? !1,
      safeModeStorageRewards: a?.safe_mode_storage_rewards ?? null,
      safeModeComputationRewards: a?.safe_mode_computation_rewards ?? null,
      safeModeStorageRebates: a?.safe_mode_storage_rebates?.toString() ?? null,
      safeModeNonRefundableStorageFee: a?.safe_mode_non_refundable_storage_fee?.toString() ?? null,
      parameters: {
        epochDurationMs: a?.parameters?.epoch_duration_ms?.toString() ?? null,
        stakeSubsidyStartEpoch: a?.parameters?.stake_subsidy_start_epoch?.toString() ?? null,
        maxValidatorCount: a?.parameters?.max_validator_count?.toString() ?? null,
        minValidatorJoiningStake: a?.parameters?.min_validator_joining_stake?.toString() ?? null,
        validatorLowStakeThreshold: a?.parameters?.validator_low_stake_threshold?.toString() ?? null,
        validatorLowStakeGracePeriod: a?.parameters?.validator_low_stake_grace_period?.toString() ?? null
      },
      storageFund: {
        totalObjectStorageRebates: a?.storage_fund?.total_object_storage_rebates ?? null,
        nonRefundableBalance: a?.storage_fund?.non_refundable_balance ?? null
      },
      stakeSubsidy: {
        balance: a?.stake_subsidy?.balance ?? null,
        distributionCounter: a?.stake_subsidy?.distribution_counter?.toString() ?? null,
        currentDistributionAmount: a?.stake_subsidy?.current_distribution_amount?.toString() ?? null,
        stakeSubsidyPeriodLength: a?.stake_subsidy?.stake_subsidy_period_length?.toString() ?? null,
        stakeSubsidyDecreaseRate: a?.stake_subsidy?.stake_subsidy_decrease_rate ?? null
      }
    } };
  }
  async listDynamicFields(e) {
    return this.#n.listDynamicFields(e);
  }
  async listTransactions(e) {
    const t = tr(e), { descending: n, after: a, before: s, limit: r } = t, i = e.filter ? await W2(this.mvr, e.filter, e.signal) : void 0;
    G2(i, t);
    const o = await this.#e({
      query: ou,
      signal: e.signal,
      variables: {
        filter: i && {
          sentAddress: i.$kind === "sender" ? i.sender : void 0,
          function: i.$kind === "function" ? [
            i.package,
            i.module,
            i.function
          ].filter(Boolean).join("::") : void 0
        },
        first: n ? void 0 : r,
        after: a,
        last: n ? r : void 0,
        before: s,
        includeTransaction: e.include?.transaction ?? !1,
        includeEffects: e.include?.effects ?? !1,
        includeEvents: e.include?.events ?? !1,
        includeBalanceChanges: e.include?.balanceChanges ?? !1,
        includeObjectTypes: e.include?.objectTypes ?? !1,
        includeBcs: e.include?.bcs ?? !1
      }
    }, (c) => c.transactions);
    return {
      transactions: (n ? [...o.nodes].reverse() : o.nodes).map((c) => Qt(c, e.include)),
      hasNextPage: n ? o.pageInfo.hasPreviousPage : o.pageInfo.hasNextPage,
      startCursor: (n ? o.pageInfo.endCursor : o.pageInfo.startCursor) ?? null,
      endCursor: (n ? o.pageInfo.startCursor : o.pageInfo.endCursor) ?? null
    };
  }
  async listEvents(e) {
    const { descending: t, after: n, before: a, limit: s } = tr(e), r = e.filter ? await Q2(this.mvr, e.filter, e.signal) : void 0, i = await this.#e({
      query: K5,
      signal: e.signal,
      variables: {
        filter: r && {
          sender: r.$kind === "sender" ? r.sender : void 0,
          module: r.$kind === "emitModule" ? `${r.package}::${r.module}` : void 0,
          type: r.$kind === "eventTypeModule" ? `${r.package}::${r.module}` : r.$kind === "eventType" ? r.eventType : void 0
        },
        first: t ? void 0 : s,
        after: n,
        last: t ? s : void 0,
        before: a
      }
    }, (o) => o.events);
    return {
      events: (t ? [...i.nodes].reverse() : i.nodes).map((o) => {
        const c = o.transactionModule?.package?.address, u = o.transactionModule?.name, f = o.sender?.address, l = o.contents?.type?.repr, b = o.transaction?.digest;
        if (!c || !u || !f || !l || !b) throw new Error("listEvents response is missing expected event fields");
        return {
          packageId: j(c),
          module: u,
          sender: j(f),
          eventType: Z0(l),
          bcs: o.contents?.bcs ? w0(o.contents.bcs) : new Uint8Array(),
          json: o.contents?.json ?? null,
          checkpoint: o.transaction?.effects?.checkpoint?.sequenceNumber?.toString() ?? null,
          transactionDigest: b,
          eventIndex: o.sequenceNumber
        };
      }),
      hasNextPage: t ? i.pageInfo.hasPreviousPage : i.pageInfo.hasNextPage,
      startCursor: (t ? i.pageInfo.endCursor : i.pageInfo.startCursor) ?? null,
      endCursor: (t ? i.pageInfo.startCursor : i.pageInfo.endCursor) ?? null
    };
  }
  async verifyZkLoginSignature(e) {
    const t = e.intentScope === "TransactionData" ? Vs.TransactionData : Vs.PersonalMessage, { data: n } = await this.#n.query({
      query: du,
      signal: e.signal,
      variables: {
        bytes: e.bytes,
        signature: e.signature,
        intentScope: t,
        author: e.address
      }
    });
    return {
      success: n?.verifyZkLoginSignature?.success ?? !1,
      errors: []
    };
  }
  async defaultNameServiceName(e) {
    return { data: { name: await this.#e({
      query: eu,
      signal: e.signal,
      variables: { address: e.address }
    }, (t) => t.address?.defaultNameRecord?.domain ?? null) } };
  }
  async resolveNameServiceAddress(e) {
    const { data: t, errors: n } = await this.#n.query({
      query: tu,
      signal: e.signal,
      variables: { name: e.name }
    });
    return Wt(n), { address: t?.address?.address ?? null };
  }
  async getMoveFunction(e) {
    const t = await this.#e({
      query: q5,
      signal: e.signal,
      variables: {
        package: (await this.mvr.resolvePackage({
          package: e.packageId,
          signal: e.signal
        })).package,
        module: e.moduleName,
        function: e.name
      }
    }, (a) => a.package?.module?.function);
    let n = "unknown";
    switch (t.visibility) {
      case "PUBLIC":
        n = "public";
        break;
      case "PRIVATE":
        n = "private";
        break;
      case "FRIEND":
        n = "friend";
        break;
    }
    return { function: {
      packageId: j(e.packageId),
      moduleName: e.moduleName,
      name: t.name,
      visibility: n,
      isEntry: t.isEntry ?? !1,
      typeParameters: t.typeParameters?.map(({ constraints: a }) => ({
        isPhantom: !1,
        constraints: a.map((s) => {
          switch (s) {
            case "COPY":
              return "copy";
            case "DROP":
              return "drop";
            case "STORE":
              return "store";
            case "KEY":
              return "key";
            default:
              return "unknown";
          }
        }) ?? []
      })) ?? [],
      parameters: t.parameters?.map((a) => ar(a.signature)) ?? [],
      returns: t.return?.map(({ signature: a }) => ar(a)) ?? []
    } };
  }
  async getChainIdentifier(e) {
    const t = this.cache.read(["chainIdentifier"], async () => {
      const n = await this.#e({ query: W5 }, (a) => a.checkpoint);
      if (!n?.digest) throw new Error("Genesis checkpoint digest not found");
      return { chainIdentifier: n.digest };
    });
    return en(Promise.resolve(t), e?.signal);
  }
  resolveTransactionPlugin() {
    const e = this.#n;
    return async function(n, a, s) {
      const r = n.snapshot();
      r.sender || (r.sender = "0x0000000000000000000000000000000000000000000000000000000000000000");
      const i = Mo(r), o = Ya.toJson(i), c = !a.onlyTransactionKind && (r.gasData.budget == null || r.gasData.payment == null), { data: u, errors: f } = await e.query({
        query: cu,
        variables: {
          transaction: o,
          doGasSelection: c,
          checksEnabled: !a.onlyTransactionKind
        }
      });
      Wt(f);
      const l = u?.simulateTransaction?.effects?.transaction?.effects;
      if (!a.onlyTransactionKind && l?.status === ho.Failure) {
        const m = Uo(l.executionError);
        throw new co(`Transaction resolution failed: ${m?.message ?? "Transaction failed"}`, { executionError: m });
      }
      const b = u?.simulateTransaction?.effects?.transaction?.transactionBcs;
      if (!b) throw new Error("simulateTransaction did not return resolved transaction data");
      const g = tt.fromBytes(w0(b)).snapshot();
      return a.onlyTransactionKind ? n.applyResolvedData({
        ...g,
        sender: null,
        gasData: {
          budget: null,
          owner: null,
          payment: null,
          price: null
        },
        expiration: null
      }) : n.applyResolvedData(g), await qb({
        transactionData: n,
        client: e,
        epoch: l?.epoch?.epochId,
        originalTransactionData: r,
        isTransactionKindOnly: !!a.onlyTransactionKind,
        doGasSelection: c
      }), await s();
    };
  }
};
function nr(e, t) {
  if (e)
    return t ? {
      output: t.output ?? null,
      errors: t.errors ?? null
    } : null;
}
function Wt(e) {
  if (!e || e.length === 0) return;
  const t = e.map((n) => new Y2(n));
  throw t.length === 1 ? t[0] : new AggregateError(t);
}
var Y2 = class extends Error {
  constructor(e) {
    super(e.message), this.locations = e.locations;
  }
};
function Kn(e) {
  switch (e.__typename) {
    case "AddressOwner":
      return {
        $kind: "AddressOwner",
        AddressOwner: e.address?.address
      };
    case "ConsensusAddressOwner":
      return {
        $kind: "ConsensusAddressOwner",
        ConsensusAddressOwner: {
          owner: e?.address?.address,
          startVersion: String(e.startVersion)
        }
      };
    case "ObjectOwner":
      return {
        $kind: "ObjectOwner",
        ObjectOwner: e.address?.address
      };
    case "Immutable":
      return {
        $kind: "Immutable",
        Immutable: !0
      };
    case "Shared":
      return {
        $kind: "Shared",
        Shared: { initialSharedVersion: String(e.initialSharedVersion) }
      };
  }
}
function Qt(e, t) {
  const n = {};
  if (t?.objectTypes) {
    const c = e.effects?.effectsJson;
    c && R2.fromJson(c).changedObjects?.forEach((f) => {
      f.objectId && f.objectType && (n[f.objectId] = f.objectType);
    });
    const u = e.effects?.objectChanges?.nodes;
    if (u) for (const f of u) {
      const l = f.outputState?.asMoveObject?.contents?.type?.repr;
      f.address && l && (n[f.address] = l);
    }
  }
  let a;
  if (t?.balanceChanges) {
    const c = e.effects?.balanceChangesJson;
    Array.isArray(c) ? a = c.map((u) => {
      const f = Xb.fromJson(u);
      return {
        coinType: f.coinType,
        address: f.address,
        amount: f.amount
      };
    }) : a = [];
  }
  const s = e.effects?.status === ho.Success ? {
    success: !0,
    error: null
  } : {
    success: !1,
    error: Uo(e.effects?.executionError)
  };
  let r;
  if (t?.transaction && e.transactionJson) {
    const c = Zb(Ya.fromJson(e.transactionJson));
    r = {
      gasData: c.gasData,
      sender: c.sender,
      expiration: c.expiration,
      commands: c.commands,
      inputs: c.inputs,
      version: c.version
    };
  }
  const i = t?.bcs && e.transactionBcs ? w0(e.transactionBcs) : void 0, o = {
    digest: e.digest,
    status: s,
    effects: t?.effects ? Au(w0(e.effects?.effectsBcs)) : void 0,
    epoch: e.effects?.epoch?.epochId?.toString() ?? null,
    objectTypes: t?.objectTypes ? n : void 0,
    transaction: r,
    bcs: i,
    signatures: e.signatures.map((c) => c.signatureBytes),
    balanceChanges: a,
    events: t?.events ? e.effects?.events?.nodes.map((c) => {
      const u = c.contents?.type?.repr, [f, l] = u.split("::");
      return {
        packageId: f,
        module: l,
        sender: c.sender?.address,
        eventType: u,
        bcs: c.contents?.bcs ? w0(c.contents.bcs) : new Uint8Array(),
        json: c.contents?.json ?? null
      };
    }) ?? [] : void 0
  };
  return s.success ? {
    $kind: "Transaction",
    Transaction: o,
    FailedTransaction: void 0
  } : {
    $kind: "FailedTransaction",
    Transaction: void 0,
    FailedTransaction: o
  };
}
function ar(e) {
  let t = null;
  return e.ref === "&" ? t = "immutable" : e.ref === "&mut" && (t = "mutable"), {
    reference: t,
    body: Oa(e.body)
  };
}
function Uo(e) {
  if (Z2(e) === "MoveAbort" && e?.abortCode != null) {
    const t = q2(e), n = H2(e), a = e.message?.match(/in (\d+)\w* command/), s = a ? parseInt(a[1], 10) - 1 : void 0;
    return {
      $kind: "MoveAbort",
      message: Ao({
        command: s,
        location: t ? {
          package: t.package,
          module: t.module,
          functionName: t.functionName,
          instruction: t.instruction
        } : void 0,
        abortCode: e.abortCode,
        cleverError: n ? {
          lineNumber: n.lineNumber,
          constantName: n.constantName,
          value: n.value
        } : void 0
      }),
      command: s,
      MoveAbort: {
        abortCode: e.abortCode,
        location: t,
        cleverError: n
      }
    };
  }
  return {
    $kind: "Unknown",
    message: e?.message ?? "Transaction failed",
    Unknown: null
  };
}
function Z2(e) {
  return e?.abortCode != null ? "MoveAbort" : e?.message?.match(/^(\w+)/)?.[1] ?? "Unknown";
}
function q2(e) {
  if (e.module?.package?.address && e.module?.name)
    return {
      package: e.module?.package?.address,
      module: e.module?.name,
      functionName: e.function?.name,
      instruction: e.instructionOffset ?? void 0
    };
}
function H2(e) {
  if (e.identifier || e.constant)
    return {
      constantName: e.identifier ?? void 0,
      value: e.constant ?? void 0,
      lineNumber: e.sourceLineNumber ?? void 0
    };
}
function Oa(e) {
  switch (e) {
    case "address":
      return { $kind: "address" };
    case "bool":
      return { $kind: "bool" };
    case "u8":
      return { $kind: "u8" };
    case "u16":
      return { $kind: "u16" };
    case "u32":
      return { $kind: "u32" };
    case "u64":
      return { $kind: "u64" };
    case "u128":
      return { $kind: "u128" };
    case "u256":
      return { $kind: "u256" };
  }
  if (typeof e == "string") throw new Error(`Unknown type: ${e}`);
  if ("vector" in e) return {
    $kind: "vector",
    vector: Oa(e.vector)
  };
  if ("datatype" in e) return {
    $kind: "datatype",
    datatype: {
      typeName: `${j(e.datatype.package)}::${e.datatype.module}::${e.datatype.type}`,
      typeParameters: e.datatype.typeParameters.map((t) => Oa(t))
    }
  };
  if ("typeParameter" in e) return {
    $kind: "typeParameter",
    index: e.typeParameter
  };
  throw new Error(`Unknown type: ${JSON.stringify(e)}`);
}
function X2(e, t) {
  if (!!!e)
    throw new Error(t);
}
const Po = {
  Name: [],
  Document: ["definitions"],
  OperationDefinition: [
    "description",
    "name",
    "variableDefinitions",
    "directives",
    "selectionSet"
  ],
  VariableDefinition: [
    "description",
    "variable",
    "type",
    "defaultValue",
    "directives"
  ],
  Variable: ["name"],
  SelectionSet: ["selections"],
  Field: ["alias", "name", "arguments", "directives", "selectionSet"],
  Argument: ["name", "value"],
  FragmentSpread: ["name", "directives"],
  InlineFragment: ["typeCondition", "directives", "selectionSet"],
  FragmentDefinition: [
    "description",
    "name",
    // Note: fragment variable definitions are deprecated and will removed in v17.0.0
    "variableDefinitions",
    "typeCondition",
    "directives",
    "selectionSet"
  ],
  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ["values"],
  ObjectValue: ["fields"],
  ObjectField: ["name", "value"],
  Directive: ["name", "arguments"],
  NamedType: ["name"],
  ListType: ["type"],
  NonNullType: ["type"],
  SchemaDefinition: ["description", "directives", "operationTypes"],
  OperationTypeDefinition: ["type"],
  ScalarTypeDefinition: ["description", "name", "directives"],
  ObjectTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  FieldDefinition: ["description", "name", "arguments", "type", "directives"],
  InputValueDefinition: [
    "description",
    "name",
    "type",
    "defaultValue",
    "directives"
  ],
  InterfaceTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  UnionTypeDefinition: ["description", "name", "directives", "types"],
  EnumTypeDefinition: ["description", "name", "directives", "values"],
  EnumValueDefinition: ["description", "name", "directives"],
  InputObjectTypeDefinition: ["description", "name", "directives", "fields"],
  DirectiveDefinition: [
    "description",
    "name",
    "arguments",
    "directives",
    "locations"
  ],
  SchemaExtension: ["directives", "operationTypes"],
  DirectiveExtension: ["name", "directives"],
  ScalarTypeExtension: ["name", "directives"],
  ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
  InterfaceTypeExtension: ["name", "interfaces", "directives", "fields"],
  UnionTypeExtension: ["name", "directives", "types"],
  EnumTypeExtension: ["name", "directives", "values"],
  InputObjectTypeExtension: ["name", "directives", "fields"],
  TypeCoordinate: ["name"],
  MemberCoordinate: ["name", "memberName"],
  ArgumentCoordinate: ["name", "fieldName", "argumentName"],
  DirectiveCoordinate: ["name"],
  DirectiveArgumentCoordinate: ["name", "argumentName"]
}, K2 = new Set(Object.keys(Po));
function sr(e) {
  const t = e?.kind;
  return typeof t == "string" && K2.has(t);
}
var rr;
(function(e) {
  e.QUERY = "query", e.MUTATION = "mutation", e.SUBSCRIPTION = "subscription";
})(rr || (rr = {}));
var Ea;
(function(e) {
  e.NAME = "Name", e.DOCUMENT = "Document", e.OPERATION_DEFINITION = "OperationDefinition", e.VARIABLE_DEFINITION = "VariableDefinition", e.SELECTION_SET = "SelectionSet", e.FIELD = "Field", e.ARGUMENT = "Argument", e.FRAGMENT_SPREAD = "FragmentSpread", e.INLINE_FRAGMENT = "InlineFragment", e.FRAGMENT_DEFINITION = "FragmentDefinition", e.VARIABLE = "Variable", e.INT = "IntValue", e.FLOAT = "FloatValue", e.STRING = "StringValue", e.BOOLEAN = "BooleanValue", e.NULL = "NullValue", e.ENUM = "EnumValue", e.LIST = "ListValue", e.OBJECT = "ObjectValue", e.OBJECT_FIELD = "ObjectField", e.DIRECTIVE = "Directive", e.NAMED_TYPE = "NamedType", e.LIST_TYPE = "ListType", e.NON_NULL_TYPE = "NonNullType", e.SCHEMA_DEFINITION = "SchemaDefinition", e.OPERATION_TYPE_DEFINITION = "OperationTypeDefinition", e.SCALAR_TYPE_DEFINITION = "ScalarTypeDefinition", e.OBJECT_TYPE_DEFINITION = "ObjectTypeDefinition", e.FIELD_DEFINITION = "FieldDefinition", e.INPUT_VALUE_DEFINITION = "InputValueDefinition", e.INTERFACE_TYPE_DEFINITION = "InterfaceTypeDefinition", e.UNION_TYPE_DEFINITION = "UnionTypeDefinition", e.ENUM_TYPE_DEFINITION = "EnumTypeDefinition", e.ENUM_VALUE_DEFINITION = "EnumValueDefinition", e.INPUT_OBJECT_TYPE_DEFINITION = "InputObjectTypeDefinition", e.DIRECTIVE_DEFINITION = "DirectiveDefinition", e.SCHEMA_EXTENSION = "SchemaExtension", e.DIRECTIVE_EXTENSION = "DirectiveExtension", e.SCALAR_TYPE_EXTENSION = "ScalarTypeExtension", e.OBJECT_TYPE_EXTENSION = "ObjectTypeExtension", e.INTERFACE_TYPE_EXTENSION = "InterfaceTypeExtension", e.UNION_TYPE_EXTENSION = "UnionTypeExtension", e.ENUM_TYPE_EXTENSION = "EnumTypeExtension", e.INPUT_OBJECT_TYPE_EXTENSION = "InputObjectTypeExtension", e.TYPE_COORDINATE = "TypeCoordinate", e.MEMBER_COORDINATE = "MemberCoordinate", e.ARGUMENT_COORDINATE = "ArgumentCoordinate", e.DIRECTIVE_COORDINATE = "DirectiveCoordinate", e.DIRECTIVE_ARGUMENT_COORDINATE = "DirectiveArgumentCoordinate";
})(Ea || (Ea = {}));
function ir(e) {
  return e === 9 || e === 32;
}
function e8(e, t) {
  const n = e.replace(/"""/g, '\\"""'), a = n.split(/\r\n|[\n\r]/g), s = a.length === 1, r = a.length > 1 && a.slice(1).every((g) => g.length === 0 || ir(g.charCodeAt(0))), i = n.endsWith('\\"""'), o = e.endsWith('"') && !i, c = e.endsWith("\\"), u = o || c, f = (
    // add leading and trailing new lines only if it improves readability
    !s || e.length > 70 || u || r || i
  );
  let l = "";
  const b = s && ir(e.charCodeAt(0));
  return (f && !b || r) && (l += `
`), l += n, (f || u) && (l += `
`), '"""' + l + '"""';
}
const t8 = 10, Vo = 2;
function n8(e) {
  return jn(e, []);
}
function jn(e, t) {
  switch (typeof e) {
    case "string":
      return JSON.stringify(e);
    case "function":
      return e.name ? `[function ${e.name}]` : "[function]";
    case "object":
      return a8(e, t);
    default:
      return String(e);
  }
}
function a8(e, t) {
  if (e === null)
    return "null";
  if (t.includes(e))
    return "[Circular]";
  const n = [...t, e];
  if (s8(e)) {
    const a = e.toJSON();
    if (a !== e)
      return typeof a == "string" ? a : jn(a, n);
  } else if (Array.isArray(e))
    return i8(e, n);
  return r8(e, n);
}
function s8(e) {
  return typeof e.toJSON == "function";
}
function r8(e, t) {
  const n = Object.entries(e);
  return n.length === 0 ? "{}" : t.length > Vo ? "[" + o8(e) + "]" : "{ " + n.map(
    ([s, r]) => s + ": " + jn(r, t)
  ).join(", ") + " }";
}
function i8(e, t) {
  if (e.length === 0)
    return "[]";
  if (t.length > Vo)
    return "[Array]";
  const n = Math.min(t8, e.length), a = e.length - n, s = [];
  for (let r = 0; r < n; ++r)
    s.push(jn(e[r], t));
  return a === 1 ? s.push("... 1 more item") : a > 1 && s.push(`... ${a} more items`), "[" + s.join(", ") + "]";
}
function o8(e) {
  const t = Object.prototype.toString.call(e).replace(/^\[object /, "").replace(/]$/, "");
  if (t === "Object" && typeof e.constructor == "function") {
    const n = e.constructor.name;
    if (typeof n == "string" && n !== "")
      return n;
  }
  return t;
}
function c8(e) {
  return `"${e.replace(d8, f8)}"`;
}
const d8 = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;
function f8(e) {
  return u8[e.charCodeAt(0)];
}
const u8 = [
  "\\u0000",
  "\\u0001",
  "\\u0002",
  "\\u0003",
  "\\u0004",
  "\\u0005",
  "\\u0006",
  "\\u0007",
  "\\b",
  "\\t",
  "\\n",
  "\\u000B",
  "\\f",
  "\\r",
  "\\u000E",
  "\\u000F",
  "\\u0010",
  "\\u0011",
  "\\u0012",
  "\\u0013",
  "\\u0014",
  "\\u0015",
  "\\u0016",
  "\\u0017",
  "\\u0018",
  "\\u0019",
  "\\u001A",
  "\\u001B",
  "\\u001C",
  "\\u001D",
  "\\u001E",
  "\\u001F",
  "",
  "",
  '\\"',
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 2F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 3F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 4F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\\\",
  "",
  "",
  "",
  // 5F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 6F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\u007F",
  "\\u0080",
  "\\u0081",
  "\\u0082",
  "\\u0083",
  "\\u0084",
  "\\u0085",
  "\\u0086",
  "\\u0087",
  "\\u0088",
  "\\u0089",
  "\\u008A",
  "\\u008B",
  "\\u008C",
  "\\u008D",
  "\\u008E",
  "\\u008F",
  "\\u0090",
  "\\u0091",
  "\\u0092",
  "\\u0093",
  "\\u0094",
  "\\u0095",
  "\\u0096",
  "\\u0097",
  "\\u0098",
  "\\u0099",
  "\\u009A",
  "\\u009B",
  "\\u009C",
  "\\u009D",
  "\\u009E",
  "\\u009F"
], l8 = Object.freeze({});
function b8(e, t, n = Po) {
  const a = /* @__PURE__ */ new Map();
  for (const E of Object.values(Ea))
    a.set(E, p8(t, E));
  let s, r = Array.isArray(e), i = [e], o = -1, c = [], u = e, f, l;
  const b = [], g = [];
  do {
    o++;
    const E = o === i.length, w = E && c.length !== 0;
    if (E) {
      if (f = g.length === 0 ? void 0 : b[b.length - 1], u = l, l = g.pop(), w)
        if (r) {
          u = u.slice();
          let L = 0;
          for (const [L0, a0] of c) {
            const K = L0 - L;
            a0 === null ? (u.splice(K, 1), L++) : u[K] = a0;
          }
        } else {
          u = { ...u };
          for (const [L, L0] of c)
            u[L] = L0;
        }
      o = s.index, i = s.keys, c = s.edits, r = s.inArray, s = s.prev;
    } else if (l) {
      if (f = r ? o : i[o], u = l[f], u == null)
        continue;
      b.push(f);
    }
    let W;
    if (!Array.isArray(u)) {
      var m, p;
      sr(u) || X2(!1, `Invalid AST Node: ${n8(u)}.`);
      const L = E ? (m = a.get(u.kind)) === null || m === void 0 ? void 0 : m.leave : (p = a.get(u.kind)) === null || p === void 0 ? void 0 : p.enter;
      if (W = L?.call(t, u, f, l, b, g), W === l8)
        break;
      if (W === !1) {
        if (!E) {
          b.pop();
          continue;
        }
      } else if (W !== void 0 && (c.push([f, W]), !E))
        if (sr(W))
          u = W;
        else {
          b.pop();
          continue;
        }
    }
    if (W === void 0 && w && c.push([f, u]), E)
      b.pop();
    else {
      var y;
      s = {
        inArray: r,
        index: o,
        keys: i,
        edits: c,
        prev: s
      }, r = Array.isArray(u), i = r ? u : (y = n[u.kind]) !== null && y !== void 0 ? y : [], o = -1, c = [], l && g.push(l), l = u;
    }
  } while (s !== void 0);
  return c.length !== 0 ? c[c.length - 1][1] : e;
}
function p8(e, t) {
  const n = e[t];
  return typeof n == "object" ? n : typeof n == "function" ? {
    enter: n,
    leave: void 0
  } : {
    enter: e.enter,
    leave: e.leave
  };
}
function m8(e) {
  return b8(e, h8);
}
const g8 = 80, h8 = {
  Name: {
    leave: (e) => e.value
  },
  Variable: {
    leave: (e) => "$" + e.name
  },
  // Document
  Document: {
    leave: (e) => S(e.definitions, `

`)
  },
  OperationDefinition: {
    leave(e) {
      const t = ea(e.variableDefinitions) ? _(`(
`, S(e.variableDefinitions, `
`), `
)`) : _("(", S(e.variableDefinitions, ", "), ")"), n = _("", e.description, `
`) + S(
        [
          e.operation,
          S([e.name, t]),
          S(e.directives, " ")
        ],
        " "
      );
      return (n === "query" ? "" : n + " ") + e.selectionSet;
    }
  },
  VariableDefinition: {
    leave: ({ variable: e, type: t, defaultValue: n, directives: a, description: s }) => _("", s, `
`) + e + ": " + t + _(" = ", n) + _(" ", S(a, " "))
  },
  SelectionSet: {
    leave: ({ selections: e }) => z0(e)
  },
  Field: {
    leave({ alias: e, name: t, arguments: n, directives: a, selectionSet: s }) {
      const r = _("", e, ": ") + t;
      let i = r + _("(", S(n, ", "), ")");
      return i.length > g8 && (i = r + _(`(
`, an(S(n, `
`)), `
)`)), S([i, S(a, " "), s], " ");
    }
  },
  Argument: {
    leave: ({ name: e, value: t }) => e + ": " + t
  },
  // Fragments
  FragmentSpread: {
    leave: ({ name: e, directives: t }) => "..." + e + _(" ", S(t, " "))
  },
  InlineFragment: {
    leave: ({ typeCondition: e, directives: t, selectionSet: n }) => S(
      [
        "...",
        _("on ", e),
        S(t, " "),
        n
      ],
      " "
    )
  },
  FragmentDefinition: {
    leave: ({
      name: e,
      typeCondition: t,
      variableDefinitions: n,
      directives: a,
      selectionSet: s,
      description: r
    }) => _("", r, `
`) + // Note: fragment variable definitions are experimental and may be changed
    // or removed in the future.
    `fragment ${e}${_("(", S(n, ", "), ")")} on ${t} ${_("", S(a, " "), " ")}` + s
  },
  // Value
  IntValue: {
    leave: ({ value: e }) => e
  },
  FloatValue: {
    leave: ({ value: e }) => e
  },
  StringValue: {
    leave: ({ value: e, block: t }) => t ? e8(e) : c8(e)
  },
  BooleanValue: {
    leave: ({ value: e }) => e ? "true" : "false"
  },
  NullValue: {
    leave: () => "null"
  },
  EnumValue: {
    leave: ({ value: e }) => e
  },
  ListValue: {
    leave: ({ values: e }) => "[" + S(e, ", ") + "]"
  },
  ObjectValue: {
    leave: ({ fields: e }) => "{" + S(e, ", ") + "}"
  },
  ObjectField: {
    leave: ({ name: e, value: t }) => e + ": " + t
  },
  // Directive
  Directive: {
    leave: ({ name: e, arguments: t }) => "@" + e + _("(", S(t, ", "), ")")
  },
  // Type
  NamedType: {
    leave: ({ name: e }) => e
  },
  ListType: {
    leave: ({ type: e }) => "[" + e + "]"
  },
  NonNullType: {
    leave: ({ type: e }) => e + "!"
  },
  // Type System Definitions
  SchemaDefinition: {
    leave: ({ description: e, directives: t, operationTypes: n }) => _("", e, `
`) + S(["schema", S(t, " "), z0(n)], " ")
  },
  OperationTypeDefinition: {
    leave: ({ operation: e, type: t }) => e + ": " + t
  },
  ScalarTypeDefinition: {
    leave: ({ description: e, name: t, directives: n }) => _("", e, `
`) + S(["scalar", t, S(n, " ")], " ")
  },
  ObjectTypeDefinition: {
    leave: ({ description: e, name: t, interfaces: n, directives: a, fields: s }) => _("", e, `
`) + S(
      [
        "type",
        t,
        _("implements ", S(n, " & ")),
        S(a, " "),
        z0(s)
      ],
      " "
    )
  },
  FieldDefinition: {
    leave: ({ description: e, name: t, arguments: n, type: a, directives: s }) => _("", e, `
`) + t + (ea(n) ? _(`(
`, an(S(n, `
`)), `
)`) : _("(", S(n, ", "), ")")) + ": " + a + _(" ", S(s, " "))
  },
  InputValueDefinition: {
    leave: ({ description: e, name: t, type: n, defaultValue: a, directives: s }) => _("", e, `
`) + S(
      [t + ": " + n, _("= ", a), S(s, " ")],
      " "
    )
  },
  InterfaceTypeDefinition: {
    leave: ({ description: e, name: t, interfaces: n, directives: a, fields: s }) => _("", e, `
`) + S(
      [
        "interface",
        t,
        _("implements ", S(n, " & ")),
        S(a, " "),
        z0(s)
      ],
      " "
    )
  },
  UnionTypeDefinition: {
    leave: ({ description: e, name: t, directives: n, types: a }) => _("", e, `
`) + S(
      ["union", t, S(n, " "), _("= ", S(a, " | "))],
      " "
    )
  },
  EnumTypeDefinition: {
    leave: ({ description: e, name: t, directives: n, values: a }) => _("", e, `
`) + S(["enum", t, S(n, " "), z0(a)], " ")
  },
  EnumValueDefinition: {
    leave: ({ description: e, name: t, directives: n }) => _("", e, `
`) + S([t, S(n, " ")], " ")
  },
  InputObjectTypeDefinition: {
    leave: ({ description: e, name: t, directives: n, fields: a }) => _("", e, `
`) + S(["input", t, S(n, " "), z0(a)], " ")
  },
  DirectiveDefinition: {
    leave: ({
      description: e,
      name: t,
      arguments: n,
      directives: a,
      repeatable: s,
      locations: r
    }) => _("", e, `
`) + "directive @" + t + (ea(n) ? _(`(
`, an(S(n, `
`)), `
)`) : _("(", S(n, ", "), ")")) + _(" ", S(a, " ")) + (s ? " repeatable" : "") + " on " + S(r, " | ")
  },
  SchemaExtension: {
    leave: ({ directives: e, operationTypes: t }) => S(
      ["extend schema", S(e, " "), z0(t)],
      " "
    )
  },
  ScalarTypeExtension: {
    leave: ({ name: e, directives: t }) => S(["extend scalar", e, S(t, " ")], " ")
  },
  ObjectTypeExtension: {
    leave: ({ name: e, interfaces: t, directives: n, fields: a }) => S(
      [
        "extend type",
        e,
        _("implements ", S(t, " & ")),
        S(n, " "),
        z0(a)
      ],
      " "
    )
  },
  InterfaceTypeExtension: {
    leave: ({ name: e, interfaces: t, directives: n, fields: a }) => S(
      [
        "extend interface",
        e,
        _("implements ", S(t, " & ")),
        S(n, " "),
        z0(a)
      ],
      " "
    )
  },
  UnionTypeExtension: {
    leave: ({ name: e, directives: t, types: n }) => S(
      [
        "extend union",
        e,
        S(t, " "),
        _("= ", S(n, " | "))
      ],
      " "
    )
  },
  EnumTypeExtension: {
    leave: ({ name: e, directives: t, values: n }) => S(["extend enum", e, S(t, " "), z0(n)], " ")
  },
  InputObjectTypeExtension: {
    leave: ({ name: e, directives: t, fields: n }) => S(["extend input", e, S(t, " "), z0(n)], " ")
  },
  DirectiveExtension: {
    leave: ({ name: e, directives: t }) => S(["extend directive @" + e, S(t, " ")], " ")
  },
  // Schema Coordinates
  TypeCoordinate: {
    leave: ({ name: e }) => e
  },
  MemberCoordinate: {
    leave: ({ name: e, memberName: t }) => S([e, _(".", t)])
  },
  ArgumentCoordinate: {
    leave: ({ name: e, fieldName: t, argumentName: n }) => S([e, _(".", t), _("(", n, ":)")])
  },
  DirectiveCoordinate: {
    leave: ({ name: e }) => S(["@", e])
  },
  DirectiveArgumentCoordinate: {
    leave: ({ name: e, argumentName: t }) => S(["@", e, _("(", t, ":)")])
  }
};
function S(e, t = "") {
  var n;
  return (n = e?.filter((a) => a).join(t)) !== null && n !== void 0 ? n : "";
}
function z0(e) {
  return _(`{
`, an(S(e, `
`)), `
}`);
}
function _(e, t, n = "") {
  return t != null && t !== "" ? e + t + n : "";
}
function an(e) {
  return _("  ", e.replace(/\n/g, `
  `));
}
function ea(e) {
  var t;
  return (t = e?.some((n) => n.includes(`
`))) !== null && t !== void 0 ? t : !1;
}
var A8 = class extends Error {
};
const y8 = Symbol.for("@mysten/SuiGraphQLClient");
var w8 = class extends go {
  #n;
  #e;
  #s;
  #a;
  get mvr() {
    return this.core.mvr;
  }
  get [y8]() {
    return !0;
  }
  constructor({ url: e, fetch: t = fetch, headers: n = {}, queries: a = {}, network: s, mvr: r }) {
    super({ network: s }), this.#n = e, this.#e = a, this.#s = n, this.#a = (...i) => t(...i), this.core = new J2({
      graphqlClient: this,
      mvr: r
    });
  }
  async query(e) {
    const t = await this.#a(this.#n, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.#s
      },
      body: JSON.stringify({
        query: typeof e.query == "string" || e.query instanceof String ? String(e.query) : m8(e.query),
        variables: e.variables,
        extensions: e.extensions,
        operationName: e.operationName
      }),
      signal: e.signal
    });
    if (!t.ok) throw new A8(`GraphQL request failed: ${t.statusText} (${t.status})`);
    return await t.json();
  }
  async execute(e, t) {
    return this.query({
      ...t,
      query: this.#e[e]
    });
  }
  getObjects(e) {
    return this.core.getObjects(e);
  }
  getObject(e) {
    return this.core.getObject(e);
  }
  listCoins(e) {
    return this.core.listCoins(e);
  }
  listOwnedObjects(e) {
    return this.core.listOwnedObjects(e);
  }
  getBalance(e) {
    return this.core.getBalance(e);
  }
  listBalances(e) {
    return this.core.listBalances(e);
  }
  getCoinMetadata(e) {
    return this.core.getCoinMetadata(e);
  }
  getTransaction(e) {
    return this.core.getTransaction(e);
  }
  executeTransaction(e) {
    return this.core.executeTransaction(e);
  }
  signAndExecuteTransaction(e) {
    return this.core.signAndExecuteTransaction(e);
  }
  waitForTransaction(e) {
    return this.core.waitForTransaction(e);
  }
  simulateTransaction(e) {
    return this.core.simulateTransaction(e);
  }
  getReferenceGasPrice(e) {
    return this.core.getReferenceGasPrice(e);
  }
  getCurrentSystemState(e) {
    return this.core.getCurrentSystemState(e);
  }
  getProtocolConfig(e) {
    return this.core.getProtocolConfig(e);
  }
  getChainIdentifier(e) {
    return this.core.getChainIdentifier(e);
  }
  async listDynamicFields(e) {
    const t = e.include?.value ?? !1, { data: n, errors: a } = await this.query({
      query: Z5,
      signal: e.signal,
      variables: {
        parentId: e.parentId,
        first: e.limit,
        cursor: e.cursor,
        includeValue: t
      }
    });
    if (a?.length) throw a.length === 1 ? new Error(a[0].message) : new AggregateError(a.map((r) => new Error(r.message)));
    const s = n?.address?.dynamicFields;
    if (!s) throw new Error("Missing response data");
    return {
      dynamicFields: s.nodes.map((r) => {
        const i = r.value?.__typename === "MoveObject" ? r.value.contents?.type?.repr : r.value?.type?.repr, o = r.value?.__typename === "MoveObject", c = o ? `0x2::dynamic_object_field::Wrapper<${r.name?.type?.repr}>` : r.name?.type?.repr;
        let u;
        if (t) {
          let f;
          r.value?.__typename === "MoveValue" ? f = w0(r.value.bcs ?? "") : r.value?.__typename === "MoveObject" ? f = w0(r.value.contents?.bcs ?? "") : f = new Uint8Array(), u = {
            type: i,
            bcs: f
          };
        }
        return {
          $kind: o ? "DynamicObject" : "DynamicField",
          fieldId: Vt(e.parentId, c, w0(r.name?.bcs)),
          type: Z0(o ? `0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<${r.name?.type?.repr}>,0x2::object::ID>` : `0x2::dynamic_field::Field<${r.name?.type?.repr},${i}>`),
          name: {
            type: r.name?.type?.repr,
            bcs: w0(r.name?.bcs)
          },
          valueType: i,
          childId: o && r.value?.__typename === "MoveObject" ? r.value.address : void 0,
          value: t ? u : void 0
        };
      }),
      cursor: s.pageInfo.endCursor ?? null,
      hasNextPage: s.pageInfo.hasNextPage
    };
  }
  getDynamicField(e) {
    return this.core.getDynamicField(e);
  }
  getDynamicObjectField(e) {
    return this.core.getDynamicObjectField(e);
  }
  listTransactions(e) {
    return this.core.listTransactions(e);
  }
  listEvents(e) {
    return this.core.listEvents(e);
  }
  getMoveFunction(e) {
    return this.core.getMoveFunction(e);
  }
  resolveTransactionPlugin() {
    return this.core.resolveTransactionPlugin();
  }
  verifyZkLoginSignature(e) {
    return this.core.verifyZkLoginSignature(e);
  }
  defaultNameServiceName(e) {
    return this.core.defaultNameServiceName(e);
  }
  resolveNameServiceAddress(e) {
    return this.core.resolveNameServiceAddress(e);
  }
};
const v8 = [
  "oRzrCwcAAAUJAQAGAgYEAwofBCkCBSs6B2VLCLABYAaQAg4MngLRAgADAQgCAgIABwAABQABAAAEAgAAAAkDBAABAQkHAQACBgEEAAIHCAEAAwYFAggACAAIAAgAAQoCAQYKAgIGCgIDAQgAAgEKAgECAAEGCAACBwoJAAoJAAMBAQIGAgcKAgMDAwoCB0J5dGVzMzIGYXBwZW5kB2J5dGVzMzIFY29kZWMGZGVjb2RlBmVuY29kZQpmcm9tX2J5dGVzCHRvX2J5dGVzBnZlY3RvcgR3b3JkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAkW6NvehzGQ6KwN0UN/x5DmeGAacZUX7X8qvN9OdfcAwhkAAAAAAAAAAoCAQAAAQAABSYKADEBJgQJCgAxAyUMBQULCQwFCwUEDgUQBwAnMQILAEAGAgAAAAAAAAAMBg0GDgERBTgADQYOAhEFOAANBg4DEQU4AA0GDgQRBTgACwYCAAEBAAAKOwoAQQYGggAAAAAAAAAhBA0KAAYAAAAAAAAAAEIGFDECIQwBBQ8JDAELAQQSBRYLAAEHACcKAAYBAAAAAAAAAEIGFAwDCgMxASYEJAoDMQMlDAIFJgkMAgsCBCkFLQsAAQcAJwsDCgAGAgAAAAAAAAARAgoABiIAAAAAAAAAEQIKAAZCAAAAAAAAABECCwAGYgAAAAAAAAARAgIAAgAAAAsiBwEMBwYAAAAAAAAAAAwGCgYGIAAAAAAAAAAjBB0KBgwEDQcMAwsEDAUKAAoBCwUWQgYUDAILAwsCRAYLBgYBAAAAAAAAABYMBgUECwABCwcRBAIAAA==",
  "oRzrCwcAAAUNAQAuAi6GAQO0Ac0CBIEERgXHBJ0FB+QJ1wgIuxKAAga7FLUCCvAWigEL+hcCDPwXghEN/igsDqopHgBzBCUEJgU1BTYFNwVIBUoFSwVMACgHUgEgAVQBcAIpAjgCUwJsAm4CbwMkBngAGgIAAAAIAAARCAAAGwgBDAAAFQMAAAcDAAABAwAADwMAABIDAAEDAAIAAAAAARwHAAIEDAADEAcABBQAAAUGCAAGCQAABwoIAAgLBwAJDAcACwAMAAsNCAAMFgcADQ4HAQAADhgHAA8FDAEAAREIBwARGQQAEhMCABQXAgAVAgcAFh0CAABCAAEAAE4CAwAAYQQBAAB0BQEBDAAuBgEBDAA+BwEBDABnCAEBDABeCQoBDAAiCwEBDAByDAEBDABIDQEBDABaDgEBDABWDxABDAA5ERAAAFwSEwEMAGQUFQEMAC0WFwEMACwYGQEMAFkaGwEMAGMaHAEMACEaHAEMAFcPEAEMBV84CgAGMEJDAAovRkcACjRHEAALKksQAAsrUBcACyxRGQALPz8cAAtIQUIAC0lPFQALTSAhAQILXE0TAAtmPQEAC2g8AQAMQy4QAA0xKwEBAA06MikBAA07MwEBAA1FLzABAA1GLzABAA1RASsBAA1rKSsBAA5ELS4ADnYBLQEAEDMpAQEDEUAkJQEIEUEkCgEIEU0iIwARcTElABNbJwEBDBNpKQEBCBNuJwEBCBRlHgoAFTwKHAAVPSUcABVHOzAAFW07CgAVdwEcACAfLwMzJjUoNAMrKiolLSkoJSkqJioqKSclLjQ0NQMpKCkvKScpLzUuNi43MDouPgkpKEQlRAspKSkmKTMpLkgMKSpOKwoCCAAHCBwABQgLBQUKAgcIHAEIAgIGCAIGCAECBgsDAQkABggBAwcIAgYIAQcIHAMHCwMBCQAGCAEJAAMHCwMBCQAGCAEBBQYLAwEJAAYIAQcIDgoCBwgcAQUIBwsDAQkABggBBwgUBggTBggOBwgQCB0HCBwCBgsDAQkABggUAwcLAwEJAAYIFAsJAggPCAoCBwsDAQkABgoCAgYLAwEJAAIBCgIDBggUAgoCBQYLAwEJAAYIFAIKAgcIHAELCQIIDAgRBgcLAwEJAAcIFAIKAgsYAQgbBwgcAQsJAggNCBIDBgsDAQkABwgUCwkCCA0IEgIIDQgSAwYLAwEJAAYIFAsJAggMCBECCAwIEQEGCwMBCQABAgEIHQQIAQUIEwgCAQYIHAEIAAIGCQAHCBwDCAsIEwUBBwgcAQgaAQYJAAEIGQEIEwIJAAUBCAEBCQABCAsBCxYBCQAEAQgaCwMBCQAIGQEIFwEIFQEGCxYBCQABAQEGCBoBBwsWAQkAAgcLFgEJAAkAAQgEAQsDAQkAAQgFAQgHBAcIDgYICwoCBwgcAgEBAQgUAQYIHQcHCBQGCBMGCA4HCBAOCB0HCBwFBwgUBggTDg0KAgEIBgIGCBQOBAEKAggdCxYBCxgBCBsDBggUBggLCwkCCA8ICgEIDwgOCB0DCB0KAgUKAgsWAQsYAQgbAQsYAQgbCAEBAQEIHQgdCB0IHQEGCgIFAggdCB0IHQgdAQgIAwEBCgINDQoCAQEBAQoCBAMNAwMEBAYIFA4NCgICCgIKAgcGCBQGCAsOCgIKAgEHCBwBCxgBCB4JBwgUBggLDgoCCgILGAEIGwsWAQsYAQgeCxYBBQcIHAMHCBQGCAsLCQIIDQgSAwYIFAYICwsJAggMCBEIQWRtaW5DYXAFQm91bmQHQnl0ZXMzMgRDYWxsB0NhbGxDYXAEQ29pbgpFbmRwb2ludFYyBkZ1bmRlZAJJRA5MelJlY2VpdmVQYXJhbRBNZXNzYWdpbmdDaGFubmVsDE1lc3NhZ2luZ0ZlZRBNZXNzYWdpbmdSZWNlaXB0BE9BcHAGT3B0aW9uDFBhdXNlQ2hhbmdlZApRdW90ZVBhcmFtCFJlZ2lzdHJ5CFJlbGVhc2VkA1NVSQlTZW5kUGFyYW0LU2xvdENyZWF0ZWQGU3RyaW5nCVR4Q29udGV4dAhUeXBlTmFtZQNVSUQFVkFVTFQFVmF1bHQEVm9pZANaUk8IYWNrX3NlbnQJYW5ub3VuY2VkBWFzY2lpB2JhY2tpbmcEYmluZAVib3VuZAdieXRlczMyBGNhbGwIY2FsbF9jYXADY2FwBWNvZGVjBGNvaW4PY29tYmluZV9vcHRpb25zD2NvbmZpcm1fbHpfc2VuZA1jb25maXJtX3F1b3RlDGNvbmZpcm1fc2VuZAtjcmVhdGVfc2xvdAZkZWNvZGUHZGVzdHJveQxkZXN0cm95X25vbmULZHVtbXlfZmllbGQEZW1pdAZlbmNvZGUOZW5kcG9pbnRfcXVvdGUNZW5kcG9pbnRfc2VuZAtlbmRwb2ludF92MgVldmVudBFleGVjdXRpb25fb3B0aW9ucwdleHRyYWN0BGZpbGwMZnJvbV9hZGRyZXNzB2Zyb21faWQEZnVuZAhnZXRfcGVlcgJpZAppZF9hZGRyZXNzBGluaXQKaW50b19ieXRlcwtpbnRvX3N0cmluZwdpc19ub25lB2lzX3NvbWUHaXNfemVybwpsel9yZWNlaXZlB2x6X3NlbmQRbWVzc2FnaW5nX2NoYW5uZWwNbWVzc2FnaW5nX2ZlZRFtZXNzYWdpbmdfcmVjZWlwdANuZXcMbmV3X3JlZ2lzdHJ5A25mdAhuZnRfdHlwZQRub25lBG9hcHAGb2JqZWN0Bm9wdGlvbgZwYXVzZWQHcGF5bG9hZBJwYXlsb2FkX2Zvcl9yZXZpZXcEcGVlcgVwaGFzZQdwcm9jZXNzD3B1YmxpY190cmFuc2ZlcgVxdW90ZQlyZWNpcGllbnQIcmVnaXN0ZXINcmVnaXN0ZXJfb2FwcAhyZWdpc3RyeQ5yZWdpc3RyeV9hZG1pbgdyZXF1ZXN0BXJvdXRlBHNlbmQGc2VuZGVyFHNldF9lbmZvcmNlZF9vcHRpb25zCnNldF9wYXVzZWQIc2V0X3BlZXIMc2hhcmVfb2JqZWN0BHNsb3QEc29tZQNzdWkKdG9fYWRkcmVzcwh0cmFuc2Zlcgp0eF9jb250ZXh0CXR5cGVfbmFtZQx1aWRfdG9faW5uZXIIdmFsaWRhdGUFdmF1bHQLdmF1bHRfYWRtaW4HdmVyc2lvbhF3aXRoX29yaWdpbmFsX2lkcwx6ZXJvX2J5dGVzMzIDenJvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACACRbo296HMZDorA3RQ3/HkOZ4YBpxlRftfyq830519wo3p6OCHpjRwAZB/tpj9+KsEZ7NCIpt0sZJkBnrrxK6TG+rviJsIucOzfRkoD8H4t1uuWy3iQQ/DEg9APpo22sPeFQTPP9dXYnWeNT2dlTiWGOVX0FUml/GbUuTpJ8He79wor8ARDLLtuU4+V/Kxzmm1qZxQOwbRXlHPohLeVuJAMIAQAAAAAAAAAOBJZ1AAAFIARtoqnhW9giugSR2XiUfMG/sf0w5vgTpfsQubKx1qa6BSBIWVPi6t9KoCr5UM+OkU+9K2dSM4XnPDYRg0FFnY1FxAoCUlFmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQDCAIAAAAAAAAAAwgDAAAAAAAAAAMIBAAAAAAAAAADCAUAAAAAAAAAAwgGAAAAAAAAAAMIBwAAAAAAAAADCAgAAAAAAAAAAwgJAAAAAAAAAAMICgAAAAAAAAADCAsAAAAAAAAAAwgMAAAAAAAAAAoCFxYAAwEAEQEAAAAAAAAAAAAAAAAAAw1ACgIBAAACATIBAQICQAgaYAgZAgIHQAgadQMnCxYBCAtSBWoLFgEIGSEFUAoCAwIQQAgadQNgCBknCAtSBU8LFgEJACEIHWMIHVgIHSMBVQFZAh8BHgFiCB1dCB0EAgNgCBlzCBlPCB0FAgJzCBlPCB0GAgJzCBlYCB0HAgJzCBlVAQgCA3MIGWIIHV0IHQMpAAAAAB0pCgEuETYHAyEEBwULCwEBBwAnDgAKATgADAMMBAsDBwIHBAoBEQEMBQoBETEOBTgBEgEMAgsECgEuETY4AgsCCwEuETY4AwsFOAQCAAEAAAABCwsEETEHAAsAOAULATgGCwILAxICAgACAAAAARgKABAAFAcAIQQHBQ0LAAELAQEHDicLARABFAsAOAEhBBUFFwcAJwIAAwAAAAEZCgA3ABQHACEEBwUNCwABCwEBBw4nCwEQARQLADcBFCEEFgUYBwAnAgAEAQAALFkKAC4LARECOAcRLBEkCgAQBBQhBA0FEwsAAQsCAQcFJwoAEAU4CAQcCgAQBjgJDAMFHgkMAwsDBCEFJwsAAQsCAQcGJwsCETEMBA4EETIMBgsEBwAKAC44AQoADwY4CgoAEAcUOAsKABAIFBE3CgYROBE7CQkxAAkJETsROzkADAUKAA8FCgY4DAsALjgBCwYOBTcCFBIEOA0LBTgOAgAFAQAAMEcKAC4LATgPCgA3AxQgBAoFDgsAAQcNJwoANwQUMQAhBCAKADcFOBAEHQoANwYUDAMFIgkMAwUiCQwDCwMEJQUpCwABBwgnDgI4ERE4CgA3AhQhBDIFNgsAAQcHJwoANgULAjgSMQEKADYEFQoALjgTCwA3AhQSBTgUAgAGAQAAAQ8KAC4LATgPCgIKADYDFQsALjgTCwISBzgVAgAHAQAAAQoKAAsBOA8LAgsANwcLAwsEERYCAAgBAAA5ZgoALgsBOA8KADcGFCAEEAoANwQUMQAhDAgFEgkMCAsIBBUFIwsAAQsDAQsCAQsEAQsHAQsFAQcIJwoCLjgWCgA3CBQhBDAOBhE5IAwJBTIJDAkLCQQ1BUMLAAELAwELAgELBAELBwELBQEHCScKAgoDCwQLBQcBCgYLBxEjCgIKAwcBSAEABxARIgsCCwMHAUgDAAcQESIKBgoANgkVCAoANgYVCwAuOBMLBhIGOBcCAAkAAAAwNAoANwAUBwAhBAcFDQsAAQsBAQcOJwoBOBYKADcIFCEEFQUbCwABCwEBBwknCgA3BhQEKAsBBwERHQsANwkUIQwCBS4LAAELAQEJDAILAgQxBTMHCicCAAoBAABAMAoALgoBOBgLAQoANwcLAhEeERcMBgEBDAQBAQwFBwEhBCELBQoANwkUIQQeDgY4GQwDBSMJDAMFIwkMAwsDBCYFKgsAAQcKJwsGOBoLAA4EOBsCAAsAAABFhwELAREYDAcMCAwGDAkxAiEEGQsJCgA3ChQhBBYLBgoANwIUIQwCBRsJDAIFGwkMAgsCBB4FIgsAAQcLJwoANwsUBCcFKwsAAQcIJw4IETkgBDQOBxE5IAwDBTYJDAMLAwQ5BT0LAAEHCycKADcEFDECIQRZCggKADcMFCEEUAoHCgA3DRQhDAQFUgkMBAsEBFUFfwsAAQcMJwoANwQUMQEhBGQKADcFOBwMBQVmCQwFCwUEaQVtCwABBwgnMQIKADYEFQoICgA2DBUKBwoANg0VCgA2BTgdDgcROjgeCwAuOBMLCAsHEgg4HwIADAAAAElqCgExASEENgoANwMUIAQKBQ4LAAEHDScKADcEFDEBIQQhCgA3BTgcBB4KADcLFCAMAgUjCQwCBSMJDAILAgQmBSoLAAEHCCcxAQoANwoUCwA3AhQROxE7ERkMBAVoCwExAyEEUAoANwQUMQIhBE0KADcFOBAESgoANw4UIAwDBVIJDAMFUgkMAwVSCQwDCwMEVQVZCwABBwgnMQMKADcKFAoANwIUCgA3DBQLADcNFBEZDAQLBAIADQAAAErcAQsBMQEhBAdIAQAMAwUJSAMADAMLAwwMCgAHAQoMBxERGgwEDgRBGwYCAAAAAAAAACQEFwUbCwABBw8nCwAHAQsMCwIRGgwJDglBGwYWAAAAAAAAACYEOA4JBgAAAAAAAAAAQhsUMQAhBDUOCQYBAAAAAAAAAEIbFDEDIQwFBToJDAUFOgkMBQsFBD0FPwcPJwYCAAAAAAAAAAwNMgAAAAAAAAAAAAAAAAAAAAAMDwoNDglBGyME0wEKDQYEAAAAAAAAABYOCUEbJQRQBVIHDycOCQoNBgEAAAAAAAAAFkIbFDQGAAEAAAAAAAAYDgkKDQYCAAAAAAAAABZCGxQ0FgwODgkKDUIbFDEBIQR2BWwOCQoNBgMAAAAAAAAAFkIbFDEBIQwGBXgJDAYLBgR7BX0HDycKDgYRAAAAAAAAACEEhAEIDAgFiAEKDgYhAAAAAAAAACEMCAsIBJQBCg0GAwAAAAAAAAAWCg4WDglBGyUMBwWWAQkMBwsHBJkBBZsBBw8nMgAAAAAAAAAAAAAAAAAAAAAMCgYAAAAAAAAAAAwLCgsGEAAAAAAAAAAjBMgBCwoxCC8OCQoNBgQAAAAAAAAAFgoLFkIbFDUbDAoKDgYhAAAAAAAAACEEwwEOCQoNBhQAAAAAAAAAFgoLFkIbFDEAIQTBAQXDAQcPJwsLBgEAAAAAAAAAFgwLBZ8BCw8LChYMDwsNBgMAAAAAAAAAFgsOFgwNBUMLDzJADQMAAAAAAAAAAAAAAAAAJgTYAQXaAQcPJwsJAgAOAQAATBYKAAoBOBgKAAoCOCAMBQoBCwILAxENDAYLAQsANwcHAQsFCwYJCwQRIQIADwEAAEwsCgAuCgEuOBgKAC4KAjggDAYKAS4KAgsDEQ0MBwsCMQEhBBkICgA2CxUFHQgKADYOFQsBCwA3BwcBCwYLBwsEOCEKBS4RNjgiCwURHwIAEAEAAAEKCgAKAS44GAsBCwA3BwsCERsCABEBAAABCQoACgE4GAsBCwA3BwsCERwCABIBAAABBAsANwQUAgATAQAAAQQLADcKFAIAFAEAAAEECwA3AhQCABUBAAABBAsACwE4IAIAAgEBAQMBAwICBgIEAgICAwIFAwYDCgMLAwUDCQMDAwQDCAMHAwwDDgMPAw0CKQMpCSkKKQspDCkNKQ4pDykQKREpEikTKRQpFSkA"
], T8 = [
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000000000000000000000000002",
  "0x28de9e8e087a6347001907fb698fdf8ab0467b342229b74b19264067aebc4ae9",
  "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
  "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24",
  "0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc",
  "0x3de1504cf3fd75762759e353d9d95389618e557d0552697f19b52e4e927c1dee"
], or = {
  modules: v8,
  dependencies: T8
}, x0 = Object.freeze({ sender: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", nft: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", nftType: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT", oappPackage: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24", graphql: "https://graphql.mainnet.sui.io/graphql", chain: "35834a8a", key: "nftree-original-publish-v2-a09c67e6", maxGasMist: 200000000n, maxAge: 12e4, moduleHashes: Object.freeze(["a9a4f4f7afb74b2e4fdf3b5914caa566730e843766f6ca17829484136a78d442", "a09c67e6c1fa6c4ecf0aaa64483f498cae2eb43380537b6697051e152087d939"]) }), o0 = (e, t) => {
  if (!e) throw Error(t);
}, ta = (e, t, n) => o0(JSON.stringify(e) === JSON.stringify(t), n), Fo = (e) => new w8({ network: "mainnet", url: x0.graphql });
function I8(e) {
  const t = e?.chainIdentifier;
  o0(typeof t == "string", "Missing chain identifier."), o0((/^[a-f0-9]{8}$/.test(t) ? t : Ae(Nt(t)).slice(0, 8)) === x0.chain, "This is not Sui mainnet.");
}
function O8(e) {
  o0(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Publication did not succeed. No NFT deposit is permitted.");
  const t = e.Transaction;
  o0(t.transaction?.sender === x0.sender, "Wrong publication sender.");
  const n = t.transaction.commands;
  o0(n?.length === 2 && n[0].Publish && n[1].TransferObjects, "Unexpected publication command."), ta(n[0].Publish.modules, or.modules, "Wrong published modules."), ta(n[0].Publish.dependencies, or.dependencies, "Wrong dependencies."), ta(n[1].TransferObjects.objects.map((m) => m.NestedResult), [[0, 0]], "Upgrade authority transfer changed.");
  const a = t.transaction.inputs;
  o0(a?.length === 1, "Unexpected publication inputs.");
  const s = a[n[1].TransferObjects.address.Input]?.Pure?.bytes;
  o0(s === btoa(String.fromCharCode(...Uint8Array.from(x0.sender.slice(2).match(/../g), (m) => parseInt(m, 16)))), "Upgrade authority recipient changed."), o0(t.transaction.gasData?.owner === x0.sender, "Gas must be paid by the dev wallet.");
  const r = /* @__PURE__ */ new Set([t.effects?.gasObject?.objectId, ...(t.transaction.gasData.payment ?? []).map((m) => m.objectId)]), i = t.effects?.changedObjects;
  o0(Array.isArray(i) && !i.some((m) => m.objectId === x0.nft), "Original NFT was unexpectedly touched.");
  const o = [];
  for (const m of i)
    if (m.inputState === "Exists")
      o0(r.has(m.objectId) && m.inputOwner?.AddressOwner === x0.sender, "Unexpected existing object mutation.");
    else if (["ObjectWrite", "PackageWrite"].includes(m.outputState))
      o.push(m);
    else {
      const p = m.inputState === "DoesNotExist" && m.outputState === "DoesNotExist" && m.idOperation === "Created", y = m.inputState === "DoesNotExist" && m.outputState === "AccumulatorWriteV1" && m.idOperation === "None" && m.outputOwner === null;
      o0(p || y, "Unexpected object effect.");
    }
  o0(o.length === 6, "Unexpected number of created objects.");
  const c = o.map((m) => ({ id: m.objectId, type: t.objectTypes?.[m.objectId], owner: m.outputOwner })), u = c.filter((m) => m.type === "package");
  o0(u.length === 1, "Missing new package.");
  const f = u[0].id, l = [f + "::vault::Registry", f + "::vault::AdminCap", x0.oappPackage + "::oapp::OApp", x0.oappPackage + "::oapp::AdminCap", "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"];
  for (const m of l) {
    const p = c.filter((y) => y.type === m);
    o0(p.length === 1, "Created object type differs: " + m), m.endsWith("Cap") ? o0(p[0].owner?.AddressOwner === x0.sender, "A capability left the dev wallet.") : o0(p[0].owner?.Shared || p[0].owner?.$kind === "Shared", "Expected a shared empty registry/OApp.");
  }
  o0((t.events ?? []).length === 0, "Unexpected publication events.");
  const b = t.effects.gasUsed;
  o0(b, "Missing gas summary.");
  const g = BigInt(b.computationCost) + BigInt(b.storageCost) - BigInt(b.storageRebate);
  return o0(g > 0n && g <= x0.maxGasMist, "Estimated gas exceeds the reviewed 0.2-SUI limit."), o0(t.balanceChanges?.length === 1 && t.balanceChanges[0].address === x0.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -g, "Unexpected asset payment."), { gasMist: String(g), packageId: f, registryId: c.find((m) => m.type === l[0]).id, oappId: c.find((m) => m.type === l[2]).id, objects: c };
}
const E8 = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", S8 = "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92", k8 = "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1", N8 = "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322", C8 = "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e", x8 = "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7", Ve = {
  publicationDigest: E8,
  package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
  registry: S8,
  oapp: k8,
  vaultAdminCap: N8,
  oappAdminCap: C8,
  upgradeCap: x8
}, Q = Object.freeze({ ...x0, package: Ve.package, registry: Ve.registry, oapp: Ve.oapp, admin: Ve.vaultAdminCap, oappAdmin: Ve.oappAdminCap, upgrade: Ve.upgradeCap, publicationDigest: Ve.publicationDigest, key: "nftree-original-slot-v2-ac73072b", maxGasMist: 100000000n }), i0 = (e, t) => {
  if (!e) throw Error(t);
}, In = (e) => Array.isArray(e) ? "[" + e.map(In).join(",") + "]" : e && typeof e == "object" ? "{" + Object.keys(e).sort().map((t) => JSON.stringify(t) + ":" + In(e[t])).join(",") + "}" : JSON.stringify(e), na = (e, t, n) => i0(In(e) === In(t), n), _8 = /^0x[0-9a-f]{64}$/, B8 = (e) => btoa(String.fromCharCode(...Uint8Array.from(e.slice(2).match(/../g), (t) => parseInt(t, 16))));
function j8(e) {
  i0(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Slot creation did not succeed.");
  const t = e.Transaction;
  i0(t.transaction?.sender === Q.sender && t.transaction.gasData?.owner === Q.sender, "Wrong sender or gas owner.");
  const n = t.transaction.commands;
  i0(n?.length === 1, "Only one slot creation call is allowed.");
  const a = n[0].MoveCall;
  i0(a?.package === Q.package && a.module === "vault" && a.function === "create_slot", "Wrong slot function."), na(a.typeArguments, [Q.nftType], "Wrong original NFT type."), na(a.arguments.map((y) => y.Input), [0, 1], "Slot arguments changed.");
  const s = t.transaction.inputs;
  i0(s?.length === 2, "Unexpected transaction inputs.");
  const r = s[0]?.Object?.SharedObject, i = s[1]?.Object?.ImmOrOwnedObject;
  i0(r?.objectId === Q.registry && String(r.initialSharedVersion) === "1" && r.mutable === !0 && i?.objectId === Q.admin, "Wrong Registry/AdminCap inputs.");
  const o = t.effects?.changedObjects;
  i0(Array.isArray(o), "Missing effects.");
  const c = [Q.nft, Q.oapp, Q.oappAdmin, Q.upgrade, Q.package];
  i0(!o.some((y) => c.includes(y.objectId)), "A protected NFT, capability or configuration was touched.");
  const u = o.filter((y) => y.inputState === "DoesNotExist" && y.outputState === "ObjectWrite");
  i0(u.length === 1, "Expected one created Vault.");
  const f = u[0];
  i0(_8.test(f.objectId) && f.outputOwner?.Shared && f.idOperation === "Created" && t.objectTypes?.[f.objectId] === Q.package + "::vault::Vault<" + Q.nftType + ">", "Unexpected created object.");
  const l = /* @__PURE__ */ new Set([t.effects.gasObject?.objectId, ...(t.transaction.gasData.payment ?? []).map((y) => y.objectId)]);
  let b = !1;
  for (const y of o)
    if (y.inputState === "Exists") {
      if (y.objectId === Q.registry) {
        b = !0, i0(y.inputOwner?.Shared && y.outputOwner?.Shared, "Registry ownership changed.");
        continue;
      }
      if (y.objectId === Q.admin) {
        i0(y.inputOwner?.AddressOwner === Q.sender && y.outputOwner?.AddressOwner === Q.sender && y.outputState === "ObjectWrite" && t.objectTypes[y.objectId] === Q.package + "::vault::AdminCap", "Admin capability changed owner or type.");
        continue;
      }
      i0(l.has(y.objectId) && y.inputOwner?.AddressOwner === Q.sender, "Unexpected existing object mutation.");
    } else y.objectId !== f.objectId && i0(y.inputState === "DoesNotExist" && y.outputState === "AccumulatorWriteV1" && y.idOperation === "None" && y.outputOwner === null, "Unexpected additional object effect.");
  i0(b, "Registry update is missing."), i0(t.events?.length === 1, "Unexpected events.");
  const g = t.events[0];
  i0(g.eventType === Q.package + "::vault::SlotCreated", "Wrong slot event."), na(g.json, { registry: Q.registry, vault: f.objectId, nft: { bytes: B8(Q.nft) } }, "Slot event/backing changed.");
  const m = t.effects.gasUsed;
  i0(m, "Missing gas estimate.");
  const p = BigInt(m.computationCost) + BigInt(m.storageCost) - BigInt(m.storageRebate);
  return i0(p > 0n && p <= Q.maxGasMist, "Gas exceeds the reviewed 0.1-SUI estimate ceiling."), i0(t.balanceChanges?.length === 1 && t.balanceChanges[0].address === Q.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -p, "Unexpected payment or recipient."), { gasMist: String(p), vaultId: f.objectId, packageId: Q.package, registryId: Q.registry };
}
async function $o(e) {
  if (typeof e != "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(e)) throw Error("Invalid bytecode.");
  const t = Uint8Array.from(e.slice(2).match(/../g) ?? [], (n) => parseInt(n, 16));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", t)), (n) => n.toString(16).padStart(2, "0")).join("");
}
function U(e, t = "wallet RPC") {
  if (typeof e == "bigint" || typeof e == "number" && Number.isSafeInteger(e) || typeof e == "string" && (/^(0x[0-9a-f]+)$/i.test(e) || /^(0|[1-9][0-9]*)$/.test(e))) {
    const s = BigInt(e);
    if (s >= 0n && s < 1n << 256n) return s;
  }
  const a = e === null ? "null" : Array.isArray(e) ? "array" : typeof e;
  throw Error(t + " returned an invalid numeric response (" + a + "). Refresh the checks; if it persists, send this exact message back.");
}
async function r0(e, t) {
  let n;
  try {
    let a = await Promise.race([
      e.request({ ...t, params: t.params ?? [] }),
      new Promise((s, r) => {
        n = setTimeout(() => r(Error(t.method + " did not respond within 30 seconds. Refresh the deployment checks.")), 3e4);
      })
    ]);
    if (a && typeof a == "object" && a.jsonrpc === "2.0" && Object.hasOwn(a, "id")) {
      if (a.error) throw Object.assign(Error(t.method + ": " + String(a.error.message ?? "Wallet RPC error").slice(0, 200)), { code: a.error.code });
      if (!Object.hasOwn(a, "result")) throw Error(t.method + " returned an incomplete JSON-RPC response.");
      a = a.result;
    }
    return a;
  } finally {
    clearTimeout(n);
  }
}
async function M8(e, t, n = []) {
  return U(await r0(e, { method: t, params: n }), t);
}
const R8 = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase();
async function we(e, t) {
  if (await M8(e, "eth_chainId") !== 56n) throw Error("Select BNB Smart Chain mainnet in your wallet.");
  const n = await r0(e, { method: "eth_accounts" });
  if (!Array.isArray(n) || !R8(n[0], t.from)) throw Error("Select the designated BNB wallet: " + t.from);
}
function sn(e, t, n) {
  const a = JSON.stringify(n);
  if (e.setItem(t, a), e.getItem(t) !== a) throw Error("Cannot persist deployment state.");
}
const D8 = Object.freeze(["https://bsc-dataseed.bnbchain.org", "https://bsc-dataseed-public.bnbchain.org"]), U8 = /* @__PURE__ */ new Set(["eth_blockNumber", "eth_getCode", "eth_call", "eth_getTransactionCount", "eth_estimateGas", "eth_gasPrice", "eth_getBalance", "eth_getTransactionReceipt", "eth_getTransactionByHash"]);
function y3(e, { fetcher: t = fetch, endpoints: n = D8 } = {}) {
  let a = 0, s = 0;
  const r = /* @__PURE__ */ new Set(), i = async (o, c, u) => {
    const f = ++s;
    let l;
    try {
      l = await t(o, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify({ jsonrpc: "2.0", id: f, method: c, params: u ?? [] }), signal: AbortSignal.timeout(8e3) });
    } catch {
      throw Object.assign(Error("Read endpoint could not be reached."), { transport: !0 });
    }
    if (!l.ok) throw Object.assign(Error("Read endpoint returned HTTP " + l.status + "."), { transport: !0 });
    let b;
    try {
      b = await l.json();
    } catch {
      throw Object.assign(Error("Read endpoint returned invalid JSON."), { transport: !0 });
    }
    if (b?.jsonrpc !== "2.0" || b.id !== f) throw Error("Read endpoint response identity mismatch.");
    if (b.error) {
      const g = Error(String(b.error.message ?? "RPC error").slice(0, 250));
      throw ([-32005, -32603, -32601].includes(b.error.code) || /rate limit|too many requests|temporarily unavailable|limit exceeded/i.test(g.message)) && (g.transport = !0), g;
    }
    if (!Object.hasOwn(b, "result")) throw Error("Read endpoint returned no result.");
    return b.result;
  };
  return { request: async (o) => {
    if (!U8.has(o.method)) return e.request(o);
    let c;
    for (let u = 0; u < n.length; u++) {
      const f = (a + u) % n.length, l = n[f];
      try {
        if (!r.has(l)) {
          if (U(await i(l, "eth_chainId", []), "public chain ID") !== 56n) throw Error("Public read endpoint is not BNB mainnet.");
          r.add(l);
        }
        const b = await i(l, o.method, o.params);
        return a = f, b;
      } catch (b) {
        if (c = b, !b.transport) throw Error(o.method + ": " + b.message);
        r.delete(l);
      }
    }
    throw Error(o.method + ": BNB read connections are temporarily unavailable. Your pending receipt is retained. " + String(c?.message ?? ""));
  } };
}
const vt = Sn.contracts.TreePassAdapter, at = Object.freeze({ from: gs.from, chainId: "0x38", endpoint: gs.endpoint, endpointSha256: "c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039", peer: mt.packagePeerIdentity, route: mt.vault, nft: mt.nft, slotDigest: mt.slotDigest, publicationDigest: mt.publicationDigest, key: "nftree-original-bnb-adapter-v2-45bf0849", maxAge: 12e4 });
ri({ abi: vt.abi, bytecode: vt.creationBytecode, args: [at.peer, at.route] });
const Jt = (e, t) => {
  if (!e) throw Error(t);
};
function Lo() {
  let e = vt.runtimeTemplate.slice(2);
  const t = { 61: at.peer, 63: at.route, 65: at.from };
  Jt(Object.keys(vt.immutableReferences).length === 3, "Reviewed immutable layout changed.");
  for (const [n, a] of Object.entries(vt.immutableReferences)) {
    Jt(t[n], "Unknown immutable.");
    const s = t[n].slice(2).toLowerCase().padStart(64, "0");
    for (const r of a) {
      Jt(r.length === 32, "Wrong immutable width.");
      const i = r.start * 2;
      Jt(e.slice(i, i + 64) === "0".repeat(64), "Runtime template is not unbound."), e = e.slice(0, i) + s + e.slice(i + 64);
    }
  }
  return "0x" + e;
}
const Tt = Sn.contracts.TreeSuitePass, nt = Object.freeze({ from: md.from, chainId: "0x38", endpoint: at.endpoint, endpointSha256: "c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039", peer: Pe.packagePeerIdentity, route: Pe.vault, nft: Pe.nft, slotDigest: Pe.slotDigest, publicationDigest: Pe.publicationDigest, adapter: Pe.bnbAdapter, adapterDigest: Pe.bnbAdapterDigest, currency: "0x55d398326f99059ff775485246999027b3197955", currencySha256: "a5a6d887c581c25cba4104e4281a530044ba59d718e62cdaa80ef89900299d50", treasury: "0xc440f06bbc7e58b0d055815f915447e4ae0e3720", price: "25000000000000000000", key: "nftree-original-bnb-pass-v2-90b5292a", maxAge: 12e4 });
ri({ abi: Tt.abi, bytecode: Tt.creationBytecode, args: [nt.adapter] });
const Yt = (e, t) => {
  if (!e) throw Error(t);
};
function zo() {
  let e = Tt.runtimeTemplate.slice(2);
  const t = { 870: nt.adapter, 872: nt.from, 874: nt.from, 876: nt.route };
  Yt(Object.keys(Tt.immutableReferences).length === 4, "Reviewed immutable layout changed.");
  for (const [n, a] of Object.entries(Tt.immutableReferences)) {
    Yt(t[n], "Unknown immutable.");
    const s = t[n].slice(2).toLowerCase().padStart(64, "0");
    for (const r of a) {
      Yt(r.length === 32, "Wrong immutable width.");
      const i = r.start * 2;
      Yt(e.slice(i, i + 64) === "0".repeat(64), "Runtime template is not unbound."), e = e.slice(0, i) + s + e.slice(i + 64);
    }
  }
  return "0x" + e;
}
const Be = Object.freeze({ ...nt, pass: ms.bnbPass, passDigest: ms.bnbPassDigest, key: "nftree-original-bnb-binding-v2-1d3da001" });
De({ abi: Sn.contracts.TreePassAdapter.abi, functionName: "bindPass", args: [Be.pass] });
Object.freeze({ address: Be.adapter, topics: Object.freeze([ae(R0("PassBound(address)")), "0x" + Be.pass.slice(2).toLowerCase().padStart(64, "0")]), data: "0x" });
const $ = Object.freeze({ ...Q, vault: Be.route, adapter: Be.adapter, pass: Be.pass, bindingDigest: "0x64e4369cb2cf29d7a6f8cf7ee770ac27237227df9ecfab291699c1e3211b579c", endpoint: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91", endpointPackage: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac", endpointRegistry: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec", key: "nftree-original-register-v2-ac73072b" }), s0 = (e, t) => {
  if (!e) throw Error(t);
}, cr = (e, t, n) => s0(JSON.stringify(e) === JSON.stringify(t), n), P8 = /^0x[0-9a-f]{64}$/;
function V8(e) {
  s0(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Registration failed or was already submitted. Check wallet activity.");
  const t = e.Transaction;
  s0(t.transaction?.sender === $.sender && t.transaction.gasData?.owner === $.sender, "Wrong sender or gas owner.");
  const n = t.transaction.commands;
  s0(n?.length === 1, "Only one registration command is allowed.");
  const a = n[0].MoveCall;
  s0(a?.package === $.package && a.module === "vault" && a.function === "register", "Wrong registration function."), cr(a.typeArguments, [$.nftType], "Wrong original NFT type."), cr(a.arguments.map((w) => w.Input), [0, 1, 2, 3], "Wrong registration arguments.");
  const s = t.transaction.inputs;
  s0(s?.length === 4, "Wrong input count.");
  const r = s[0]?.Object?.SharedObject, i = s[1]?.Object?.ImmOrOwnedObject, o = s[2]?.Object?.SharedObject;
  s0(r?.objectId === $.vault && String(r.initialSharedVersion) === "2" && r.mutable === !1 && i?.objectId === $.admin && o?.objectId === $.endpoint && String(o.initialSharedVersion) === "635685314" && o.mutable === !0 && s[3]?.Pure?.bytes === "AA==", "Registration inputs changed."), s0(t.events?.length === 1, "Unexpected registration events.");
  const c = t.events[0], u = c?.json?.messaging_channel;
  s0(c?.eventType === $.endpointPackage + "::oapp_registry::OAppRegisteredEvent" && c.json.oapp === $.package && c.json.oapp_info === "" && P8.test(u), "Wrong registration event/application identity.");
  const f = t.effects?.changedObjects;
  s0(Array.isArray(f), "Missing effects."), s0(!f.some((w) => [$.vault, $.nft, $.registry, $.oapp, $.oappAdmin, $.upgrade, $.package].includes(w.objectId)), "Protected custody or configuration changed.");
  const l = f.filter((w) => w.inputState === "DoesNotExist" && w.outputState === "ObjectWrite");
  s0(l.length === 2, "Expected channel and registry field only.");
  const b = l.find((w) => w.objectId === u);
  s0(b?.idOperation === "Created" && b.outputOwner?.Shared && t.objectTypes?.[u] === $.endpointPackage + "::messaging_channel::MessagingChannel", "Missing shared messaging channel.");
  const g = l.find((w) => w !== b);
  s0(g.idOperation === "Created" && g.outputOwner?.ObjectOwner === $.endpointRegistry && t.objectTypes?.[g.objectId]?.replace(/^0x0*2::/, "0x2::").replace(/\s/g, "") === "0x2::dynamic_field::Field<address," + $.endpointPackage + "::oapp_registry::OAppRegistration>", "Wrong registry field effect.");
  const m = /* @__PURE__ */ new Set([t.effects.gasObject?.objectId, ...(t.transaction.gasData.payment ?? []).map((w) => w.objectId)]);
  let p = !1;
  for (const w of f)
    w.inputState === "Exists" ? w.objectId === $.endpoint ? (p = !0, s0(w.inputOwner?.Shared && w.outputOwner?.Shared && w.outputState === "ObjectWrite", "Endpoint changed ownership.")) : w.objectId === $.admin ? s0(w.inputOwner?.AddressOwner === $.sender && w.outputOwner?.AddressOwner === $.sender && w.outputState === "ObjectWrite", "Admin changed ownership.") : s0(m.has(w.objectId) && w.inputOwner?.AddressOwner === $.sender, "Unexpected existing object mutation.") : l.includes(w) || s0(w.inputState === "DoesNotExist" && w.outputOwner === null && (w.outputState === "AccumulatorWriteV1" && w.idOperation === "None" || w.outputState === "DoesNotExist" && w.idOperation === "Created"), "Unexpected additional effects.");
  s0(p, "Endpoint update missing.");
  const y = t.effects.gasUsed;
  s0(y, "Missing gas effects.");
  const E = BigInt(y.computationCost) + BigInt(y.storageCost) - BigInt(y.storageRebate);
  return s0(E > 0n && E <= $.maxGasMist, "Gas exceeds the 0.1-SUI estimate ceiling."), s0(t.balanceChanges?.length === 1 && t.balanceChanges[0].address === $.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -E, "Unexpected payment."), { gasMist: String(E), channelId: u, registryEntryId: g.objectId };
}
const gt = Object.freeze({
  sender: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4",
  package: "0x2f3671d48dd000a27fd466fd347796149f5cd30cb16e1d22d2d89466ffc3d900",
  bridge: "0x4ae75e55799f0a4e34941503542990f1628f1b5881f0b3917bca4e255ce6b25b",
  bridgeAdmin: "0xf3c78dd3c49de3ddc4a783f1280a7f11e86cb202e1daa23df134adb0094fc292",
  oapp: "0x25a4c1a268dd726067558c8eddac5ef624b2507336ecec7d4ac1fd4553cbd789",
  admin: "0x836af3f2cae2244fad88568943692dfd87cd4eb07344edb20b74ba46a1bc93c4",
  oappPackage: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24",
  endpoint: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  endpointPackage: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
  uln: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  ulnPackage: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
  channel: "0x2b8072647e1c9fa38a020058285c10aaaed463be1b90831f63ea8a6e862cccee",
  nft: "0xc07d792d3700dea38f695d843f7eefa2e9c81efdf8aaf7da5fd151e4c58ef26c",
  executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989",
  dvns: ["0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb", "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685", "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91", "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"],
  receiveCallId: "64202616f75a5614acfa264418258521299eb6a892eeeea392feef8948c7eb53",
  remoteEid: 30102,
  graphql: "https://graphql.mainnet.sui.io/graphql",
  key: "nftree-sui-config-v1-2f3671d4"
}), F8 = "5bmbJkDF9Z8EAkSbHeq2G7dXhPPjvFZ1gJ5yf5Jam4Pc", $8 = "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef", L8 = "1058683488", z8 = "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3", Zt = {
  registrationDigest: F8,
  messagingChannel: $8,
  messagingChannelInitialSharedVersion: L8,
  endpointRegistryEntry: z8
}, G8 = h.enum("Argument", { ID: h.vector(h.u8()), Object: h.Address, Pure: h.vector(h.u8()), NestedResult: h.struct("NestedResult", { call_index: h.u16(), result_index: h.u16() }) }), W8 = h.vector(h.struct("MoveCall", { function: h.struct("Function", { package: h.Address, module_name: h.string(), name: h.string() }), arguments: h.vector(G8), type_arguments: h.vector(h.string()), is_builder_call: h.bool(), result_ids: h.vector(h.vector(h.u8())) })), Q8 = h.struct("OAppInfoV1", { oapp_object: h.Address, next_nonce_info: h.vector(h.u8()), lz_receive_info: h.vector(h.u8()), extra_info: h.vector(h.u8()) }), dr = h.struct("OAppUlnConfig", { use_default_confirmations: h.bool(), use_default_required_dvns: h.bool(), use_default_optional_dvns: h.bool(), uln_config: h.struct("UlnConfig", { confirmations: h.u64(), required_dvns: h.vector(h.Address), optional_dvns: h.vector(h.Address), optional_dvn_threshold: h.u8() }) }), J8 = h.struct("ExecutorConfig", { max_message_size: h.u64(), executor: h.Address }), T = Object.freeze({ ...$, admin: $.oappAdmin, vaultAdmin: $.admin, uln: gt.uln, ulnPackage: gt.ulnPackage, executor: gt.executor, receiveCallId: gt.receiveCallId, channel: Zt.messagingChannel, channelVersion: Zt.messagingChannelInitialSharedVersion, registration: Zt.endpointRegistryEntry, registrationDigest: Zt.registrationDigest, remoteEid: 30102, dvns: Object.freeze(gt.dvns.slice(0, 3)), key: "nftree-original-sui-config-v2-ac73072b" }), se = (e) => JSON.stringify(e, (t, n) => n && typeof n == "object" && !Array.isArray(n) ? Object.fromEntries(Object.entries(n).sort(([a], [s]) => a.localeCompare(s))) : n), ot = (e) => ({ use_default_confirmations: !1, use_default_required_dvns: !1, use_default_optional_dvns: !1, uln_config: { confirmations: String(e), required_dvns: [...T.dvns], optional_dvns: [], optional_dvn_threshold: 0 } });
function Go() {
  const e = [{ function: { package: T.package, module_name: "vault", name: "lz_receive" }, arguments: [{ Object: T.vault }, { Object: T.oapp }, { ID: Array.from(Uint8Array.from(T.receiveCallId.match(/../g), (t) => parseInt(t, 16))) }], type_arguments: [T.nftType], is_builder_call: !1, result_ids: [] }];
  return Uint8Array.from([0, 1, ...Q8.serialize({ oapp_object: T.oapp, next_nonce_info: [], lz_receive_info: [0, 1, ...W8.serialize(e).toBytes()], extra_info: [] }).toBytes()]);
}
const Wo = () => btoa(String.fromCharCode(...Go()));
function Y8(e, t) {
  if (e?.toLowerCase() !== T.sender) throw Error("Select your Sui dev wallet ending 45c4.");
  const n = new _n();
  n.setSender(T.sender);
  const a = n.sharedObjectRef({ objectId: T.oapp, initialSharedVersion: "1", mutable: !1 }), s = n.objectRef({ objectId: T.admin, version: String(t.admin.version), digest: t.admin.digest }), r = n.sharedObjectRef({ objectId: T.endpoint, initialSharedVersion: "635685314", mutable: !0 }), i = n.sharedObjectRef({ objectId: T.uln, initialSharedVersion: "635685319", mutable: !0 }), o = (c, u) => n.moveCall({ target: T.oappPackage + "::endpoint_calls::" + c, arguments: [a, s, r, ...u] });
  o("set_send_library", [n.pure.u32(T.remoteEid), n.pure.address(T.ulnPackage)]), o("set_receive_library", [n.pure.u32(T.remoteEid), n.pure.address(T.ulnPackage), n.pure.u64(0), n.object.clock()]);
  for (const [c, u] of [[1, J8.serialize({ max_message_size: "10000", executor: T.executor }).toBytes()], [2, dr.serialize(ot(5)).toBytes()], [3, dr.serialize(ot(20)).toBytes()]]) {
    const f = o("set_config", [n.pure.address(T.ulnPackage), n.pure.u32(T.remoteEid), n.pure.u32(c), n.pure.vector("u8", Array.from(u))]);
    n.moveCall({ target: T.ulnPackage + "::uln_302::set_config", arguments: [i, f] });
  }
  return o("set_oapp_info", [n.pure.vector("u8", Array.from(Go()))]), n;
}
const On = "address version digest owner{__typename ... on Shared{initialSharedVersion} ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}", qt = btoa(String.fromCharCode(...Uint8Array.from((T.package.slice(2) + "96750000").match(/../g), (e) => parseInt(e, 16)))), Le = Object.freeze({ libraries: ["0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01", "u32", "lnUAAA=="], send: ["0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5", "u32", "lnUAAA=="], receive: ["0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835", "u32", "lnUAAA=="], executor: ["0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4", "u32", "lnUAAA=="], appLibraries: ["0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920", T.endpointPackage + "::message_lib_manager::OAppConfigKey", qt], appSend: ["0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60", T.ulnPackage + "::send_uln::OAppConfigKey", qt], appReceive: ["0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09", T.ulnPackage + "::receive_uln::OAppConfigKey", qt], appExecutor: ["0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181", T.ulnPackage + "::send_uln::OAppConfigKey", qt] }), Z8 = "query { checkpoint{sequenceNumber timestamp} " + Object.entries({ endpoint: T.endpoint, uln: T.uln, oapp: T.oapp, admin: T.admin, vault: T.vault, channel: T.channel, registration: T.registration }).map(([e, t]) => e + ':object(address:"' + t + '"){' + On + "}").join(" ") + " " + Object.entries(Le).map(([e, [t, n, a]]) => e + ':address(address:"' + t + '"){dynamicField(name:{type:"' + n + '",bcs:"' + a + '"}){value{... on MoveValue{json}}}}').join(" ") + "}", q8 = {
  sequenceNumber: 346346068,
  timestamp: "2026-11-17T21:43:14.400Z"
}, H8 = {
  address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  version: 1058683488,
  digest: "81g2B8TromnKru2ns5nJ1vySThSn3dajib39968TvpaK",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685314
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
      },
      json: {
        id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        eid: 30378,
        call_cap: {
          id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
          cap_type: {
            "@variant": "Package",
            pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
          }
        },
        oapp_registry: {
          oapps: {
            id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
            size: "142"
          }
        },
        composer_registry: {
          composers: {
            id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
            size: "7"
          }
        },
        message_lib_manager: {
          registry: {
            libs: {
              contents: {
                id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                size: "2"
              }
            },
            lib_to_type: {
              id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
              size: "2"
            }
          },
          default_configs: {
            id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
            size: "126"
          },
          oapp_configs: {
            id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
            size: "99"
          }
        }
      }
    }
  }
}, X8 = {
  address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  version: 1089269256,
  digest: "DzVkeRqutE4WSvWs3Zy8GszAUzDgL6na6nUWhuco5Tff",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685319
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
      },
      json: {
        id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        call_cap: {
          id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
          cap_type: {
            "@variant": "Package",
            pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
          }
        },
        send_uln: {
          default_executor_configs: {
            id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
            size: "126"
          },
          default_uln_configs: {
            id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
            size: "126"
          },
          oapp_executor_configs: {
            id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
            size: "53"
          },
          oapp_uln_configs: {
            id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
            size: "213"
          }
        },
        receive_uln: {
          default_uln_configs: {
            id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
            size: "126"
          },
          oapp_uln_configs: {
            id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
            size: "238"
          },
          verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
        }
      }
    }
  }
}, K8 = {
  address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
  version: 1,
  digest: "8R9QHNRB56XjLsAD9UvZYWt7SELmp2JwBBFiWFwgpjxZ",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
      },
      json: {
        id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        oapp_cap: {
          id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
        peer: {
          peers: {
            id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
            size: "0"
          }
        },
        enforced_options: {
          options: {
            id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
            size: "0"
          }
        },
        sending_call: null
      }
    }
  }
}, ep = {
  address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
  version: 1,
  digest: "8U9jtqkdQ9QasCfS8TbHFwfHzHN6SPVJ52pVckw2SFy7",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
      },
      json: {
        id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
      }
    }
  }
}, tp = {
  address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
  version: 2,
  digest: "AxGpY4PqrY5q4rn44ynuoEhEMKsgum1oNum8UCoaacCm",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 2
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
      },
      json: {
        id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        version: "1",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        cap: {
          id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        nft: null,
        backing: {
          bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
        },
        route: {
          bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
        },
        peer: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        bound: !1,
        paused: !1,
        phase: 0,
        announced: !1,
        ack_sent: !1,
        request: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        recipient: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      }
    }
  }
}, np = {
  address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
  version: 1058683488,
  digest: "CuwjPYD9RTKrF9dXcVUd7SPHzWBWbuxGBFZSDLBHrjKd",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1058683488
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
      },
      json: {
        id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        channels: {
          id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
          size: "0"
        },
        is_sending: !1
      }
    }
  }
}, ap = {
  address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
  version: 1058683488,
  digest: "3UNWHJeLNi6xkvzMem8EsAXJRgYQS3Xh5ohfnuXg816q",
  owner: {
    __typename: "ObjectOwner"
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
      },
      json: {
        id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
        name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        value: {
          messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp_info: "",
          delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    }
  }
}, sp = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, rp = {
  dynamicField: {
    value: {
      json: {
        confirmations: "5",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, ip = {
  dynamicField: {
    value: {
      json: {
        confirmations: "20",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, op = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, cp = {
  dynamicField: null
}, dp = {
  dynamicField: null
}, fp = {
  dynamicField: null
}, up = {
  dynamicField: null
}, Ke = {
  checkpoint: q8,
  endpoint: H8,
  uln: X8,
  oapp: K8,
  admin: ep,
  vault: tp,
  channel: np,
  registration: ap,
  libraries: sp,
  send: rp,
  receive: ip,
  executor: op,
  appLibraries: cp,
  appSend: dp,
  appReceive: fp,
  appExecutor: up
}, Z = (e, t) => {
  if (!e) throw Error(t);
}, C0 = (e, t, n) => Z(se(e) === se(t), n), Ee = (e) => e?.asMoveObject?.contents?.json, lp = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/, Sa = ["appLibraries", "appExecutor", "appSend", "appReceive"], aa = Object.freeze(Object.fromEntries(Sa.map((e) => {
  const [t, n, a] = Le[e], [s, r, i] = n.split("::");
  return [e, { id: Vt(t, { struct: { address: s, module: r, name: i, typeParams: [] } }, Uint8Array.from(atob(a), (o) => o.charCodeAt(0))), parent: t }];
})));
function bp(e, t = 0) {
  Z(t === 0 || t === 1, "Unknown route configuration stage.");
  for (const r of ["endpoint", "uln", "oapp", "admin", "vault", "channel", "registration"]) {
    const i = e[r], o = Ke[r];
    Z(i?.address === o.address, "Wrong " + r + " object."), C0(i.owner, o.owner, r + " ownership changed."), C0(i.asMoveObject?.contents?.type, o.asMoveObject.contents.type, r + " type changed.");
  }
  for (const r of ["oapp", "admin", "vault", "channel"]) C0(Ee(e[r]), Ee(Ke[r]), "Original " + r + " changed. Verify wallet activity.");
  const n = Ee(e.endpoint), a = Ee(e.uln);
  Z(n.eid === 30378, "Wrong endpoint ID."), C0(n.call_cap, Ee(Ke.endpoint).call_cap, "Endpoint capability changed."), C0(a.call_cap, Ee(Ke.uln).call_cap, "ULN capability changed.");
  for (const [r, i] of [[n.message_lib_manager.default_configs.id, Le.libraries[0]], [n.message_lib_manager.oapp_configs.id, Le.appLibraries[0]], [a.send_uln.oapp_executor_configs.id, Le.appExecutor[0]], [a.send_uln.oapp_uln_configs.id, Le.appSend[0]], [a.receive_uln.oapp_uln_configs.id, Le.appReceive[0]]]) Z(r === i, "Protocol configuration table changed.");
  for (const r of ["libraries", "executor", "send", "receive"]) C0(e[r], Ke[r], "Protocol default " + r + " changed. Review before continuing.");
  const s = structuredClone(Ee(Ke.registration));
  t === 1 && (s.value.oapp_info = Wo()), C0(Ee(e.registration), s, "Registration channel, metadata or delegate changed.");
  for (const r of Sa) Z(e[r] && Object.hasOwn(e[r], "dynamicField"), "Missing " + r + " lookup.");
  if (t === 0)
    for (const r of Sa) Z(e[r].dynamicField === null, "Application settings already exist. Check the configuration receipt.");
  else {
    const r = (i) => e[i].dynamicField?.value?.json;
    C0(r("appLibraries"), { send_lib: T.ulnPackage, receive_lib: T.ulnPackage, receive_lib_timeout: null }, "Application libraries differ."), C0(r("appExecutor"), { max_message_size: "10000", executor: T.executor }, "Application executor differs."), C0(r("appSend"), ot(5), "Application send security differs."), C0(r("appReceive"), ot(20), "Application receive security differs.");
  }
  return e;
}
const fr = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n));
function pp(e) {
  Z(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Route configuration did not succeed.");
  const t = e.Transaction;
  Z(t.transaction?.sender === T.sender && t.transaction.gasData?.owner === T.sender, "Wrong sender or gas owner.");
  const n = t.transaction.inputs?.flatMap((b) => b.Object?.ImmOrOwnedObject ? [b.Object.ImmOrOwnedObject] : []);
  Z(n?.length === 1 && n[0].objectId === T.admin && /^[1-9][0-9]*$/.test(String(n[0].version)) && lp.test(n[0].digest), "Wrong OApp admin reference.");
  const a = Y8(T.sender, { admin: n[0] }).getData();
  for (const b of ["commands", "inputs"]) C0(fr(t.transaction[b]), fr(a[b]), "Only the exact reviewed route configuration " + b + " are allowed.");
  const s = [
    [T.endpointPackage + "::message_lib_manager::SendLibrarySetEvent", { sender: T.package, dst_eid: 30102, new_lib: T.ulnPackage }],
    [T.endpointPackage + "::message_lib_manager::ReceiveLibrarySetEvent", { receiver: T.package, src_eid: 30102, new_lib: T.ulnPackage }],
    [T.endpointPackage + "::message_lib_manager::ReceiveLibraryTimeoutSetEvent", { receiver: T.package, src_eid: 30102, old_lib: "0x" + "0".repeat(64), expiry: "0" }],
    [T.ulnPackage + "::send_uln::ExecutorConfigSetEvent", { sender: T.package, dst_eid: 30102, config: { max_message_size: "10000", executor: T.executor } }],
    [T.ulnPackage + "::send_uln::UlnConfigSetEvent", { sender: T.package, dst_eid: 30102, config: ot(5) }],
    [T.ulnPackage + "::receive_uln::UlnConfigSetEvent", { receiver: T.package, src_eid: 30102, config: ot(20) }],
    [T.endpointPackage + "::oapp_registry::OAppInfoSetEvent", { oapp: T.package, oapp_info: Wo() }]
  ];
  C0(t.events?.map((b) => [b.eventType, b.json]), s, "Configuration events differ from the reviewed settings.");
  const r = t.effects?.changedObjects;
  Z(Array.isArray(r), "Missing effects."), Z(!r.some((b) => [T.vault, T.nft, T.oapp, T.vaultAdmin, T.registry, T.channel, T.upgrade].filter(Boolean).includes(b.objectId)), "Protected NFT, Vault, OApp or channel changed.");
  const i = /* @__PURE__ */ new Set([t.effects.gasObject?.objectId, ...(t.transaction.gasData.payment ?? []).map((b) => b.objectId)]), o = /* @__PURE__ */ new Set([T.admin, T.endpoint, T.uln, T.registration]);
  let c = /* @__PURE__ */ new Set();
  for (const b of r)
    if (b.inputState === "Exists")
      o.has(b.objectId) ? (c.add(b.objectId), Z(b.outputState === "ObjectWrite" && b.idOperation === "None", "Unexpected existing object operation."), b.objectId === T.admin ? Z(b.inputOwner?.AddressOwner === T.sender && b.outputOwner?.AddressOwner === T.sender, "Admin authority moved.") : b.objectId === T.registration ? Z(b.inputOwner?.ObjectOwner === T.endpointRegistry && b.outputOwner?.ObjectOwner === T.endpointRegistry, "Registration ownership changed.") : Z(String(b.inputOwner?.Shared?.initialSharedVersion) === (b.objectId === T.endpoint ? "635685314" : "635685319") && String(b.outputOwner?.Shared?.initialSharedVersion) === (b.objectId === T.endpoint ? "635685314" : "635685319"), "Protocol ownership changed.")) : Z(i.has(b.objectId) && b.inputOwner?.AddressOwner === T.sender, "Unexpected existing object mutation.");
    else if (b.outputState === "ObjectWrite") {
      const g = Object.values(aa).find((m) => m.id === b.objectId);
      Z(g && b.idOperation === "Created" && b.outputOwner?.ObjectOwner === g.parent, "Unexpected new configuration object.");
    } else Z(b.inputState === "DoesNotExist" && b.outputOwner === null && (b.outputState === "AccumulatorWriteV1" && b.idOperation === "None" || b.outputState === "DoesNotExist" && b.idOperation === "Created"), "Unexpected additional object effect.");
  Z(r.filter((b) => b.inputState === "DoesNotExist" && b.outputState === "DoesNotExist" && b.idOperation === "Created").length <= 3, "Unexpected ephemeral object count."), Z(c.size === o.size, "Missing reviewed configuration writes.");
  const u = r.filter((b) => b.inputState === "DoesNotExist" && b.outputState === "ObjectWrite");
  Z(u.length === 4 && Object.values(aa).every((b) => u.some((g) => g.objectId === b.id)), "Expected exactly four application configuration entries.");
  const f = t.effects.gasUsed;
  Z(f, "Missing gas effects.");
  const l = BigInt(f.computationCost) + BigInt(f.storageCost) - BigInt(f.storageRebate);
  return Z(l > 0n && l <= 100000000n, "Gas exceeds the 0.1-SUI estimate ceiling."), Z(t.balanceChanges?.length === 1 && t.balanceChanges[0].address === T.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -l, "Unexpected balance change."), { gasMist: String(l), channelId: T.channel, configuredEntries: Object.fromEntries(Object.entries(aa).map(([b, g]) => [b, g.id])) };
}
const mp = {
  sequenceNumber: 346361387,
  timestamp: "2026-11-17T22:44:46.374Z"
}, gp = {
  address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  version: 1089269257,
  digest: "H6f3o8W3vwRQ2piaKwAbMb123qVBPk9SR4UmhoKbzvm6",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685314
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
      },
      json: {
        id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        eid: 30378,
        call_cap: {
          id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
          cap_type: {
            "@variant": "Package",
            pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
          }
        },
        oapp_registry: {
          oapps: {
            id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
            size: "142"
          }
        },
        composer_registry: {
          composers: {
            id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
            size: "7"
          }
        },
        message_lib_manager: {
          registry: {
            libs: {
              contents: {
                id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                size: "2"
              }
            },
            lib_to_type: {
              id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
              size: "2"
            }
          },
          default_configs: {
            id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
            size: "126"
          },
          oapp_configs: {
            id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
            size: "100"
          }
        }
      }
    }
  }
}, hp = {
  address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  version: 1089269257,
  digest: "AcckrdnV5VRmY8Ejt95EwQCMBFA7GFjwqpa5nmh3HuS9",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685319
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
      },
      json: {
        id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        call_cap: {
          id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
          cap_type: {
            "@variant": "Package",
            pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
          }
        },
        send_uln: {
          default_executor_configs: {
            id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
            size: "126"
          },
          default_uln_configs: {
            id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
            size: "126"
          },
          oapp_executor_configs: {
            id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
            size: "54"
          },
          oapp_uln_configs: {
            id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
            size: "214"
          }
        },
        receive_uln: {
          default_uln_configs: {
            id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
            size: "126"
          },
          oapp_uln_configs: {
            id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
            size: "239"
          },
          verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
        }
      }
    }
  }
}, Ap = {
  address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
  version: 1,
  digest: "8R9QHNRB56XjLsAD9UvZYWt7SELmp2JwBBFiWFwgpjxZ",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
      },
      json: {
        id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        oapp_cap: {
          id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
        peer: {
          peers: {
            id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
            size: "0"
          }
        },
        enforced_options: {
          options: {
            id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
            size: "0"
          }
        },
        sending_call: null
      }
    }
  }
}, yp = {
  address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
  version: 1089269257,
  digest: "CD4yw8W8Qyu3wgPCwWjFJ71yavSaQmhdpYgSKdfUT1yK",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
      },
      json: {
        id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
      }
    }
  }
}, wp = {
  address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
  version: 2,
  digest: "AxGpY4PqrY5q4rn44ynuoEhEMKsgum1oNum8UCoaacCm",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 2
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
      },
      json: {
        id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        version: "1",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        cap: {
          id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        nft: null,
        backing: {
          bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
        },
        route: {
          bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
        },
        peer: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        bound: !1,
        paused: !1,
        phase: 0,
        announced: !1,
        ack_sent: !1,
        request: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        recipient: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      }
    }
  }
}, vp = {
  address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
  version: 1058683488,
  digest: "CuwjPYD9RTKrF9dXcVUd7SPHzWBWbuxGBFZSDLBHrjKd",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1058683488
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
      },
      json: {
        id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        channels: {
          id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
          size: "0"
        },
        is_sending: !1
      }
    }
  }
}, Tp = {
  address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
  version: 1089269257,
  digest: "NVoFVPBULujFwR6gJrECtCiTS25JvWbTmd9LKuhMaR9",
  owner: {
    __typename: "ObjectOwner"
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
      },
      json: {
        id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
        name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        value: {
          messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp_info: "AAEceUXklt3krTFC6/jVK5WUb07TRDVo3vqbl97DB8D50QDwAQABAaxzByuU8UqHsjeBxwBMd99nmf3uEJ8kJx1GlrxKZRSkBXZhdWx0Cmx6X3JlY2VpdmUDAUW/CEmXhOqf9liTcWWpRJ1QmqN95HpyivROkDOH88osARx5ReSW3eStMULr+NUrlZRvTtNENWje+puX3sMHwPnRACBkICYW91pWFKz6JkQYJYUhKZ62qJLu7qOS/u+JSMfrUwFTMHhmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQAAAA=",
          delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    }
  }
}, Ip = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, Op = {
  dynamicField: {
    value: {
      json: {
        confirmations: "5",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, Ep = {
  dynamicField: {
    value: {
      json: {
        confirmations: "20",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, Sp = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, kp = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, Np = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "5",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, Cp = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "20",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, xp = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, _p = {
  address: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
  version: 2,
  digest: "6dLNdxRWrpZdVjyq8YTqYq7bTvWQqnJVqx4qM3DPFD4y",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Registry"
      },
      json: {
        id: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        version: "1",
        cap: null,
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        slot: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        backing: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        nft_type: "ZjZjNmQ0MzllYTBkYTJmM2U5YmE3OWU0OTkyYTdhNGMxMTMyMTVmYmY1NGM0NDJhYzkwMjBjMzE1Zjk1MzcwNTo6Y29sbGVjdGlvbjo6TkZU"
      }
    }
  }
}, Bp = {
  address: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
  version: 1058683488,
  digest: "AFLwJ2uMtTgtn9CiiMMfAh3fmVQX18zWrXYn7oYnksZW",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::AdminCap"
      },
      json: {
        id: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92"
      }
    }
  }
}, jp = {
  address: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
  version: 1,
  digest: "BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"
      },
      json: {
        id: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
        package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        version: "1",
        policy: 0
      }
    }
  }
}, Mp = {
  address: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
  version: 986499448,
  digest: "HXroMY2h1sVdUcu71aVxXYiSEtEsGFmAEaNMVX8DscEt",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      },
      json: {
        id: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        number: "2720",
        name: "Tree NFT #2720",
        description: "A unique tree from the Tree NFT collection. Rarity: Common",
        image_url: "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",
        rarity: "Common"
      }
    }
  }
}, be = {
  checkpoint: mp,
  endpoint: gp,
  uln: hp,
  oapp: Ap,
  admin: yp,
  vault: wp,
  channel: vp,
  registration: Tp,
  libraries: Ip,
  send: Op,
  receive: Ep,
  executor: Sp,
  appLibraries: kp,
  appSend: Np,
  appReceive: Cp,
  appExecutor: xp,
  registry: _p,
  vaultAdmin: Bp,
  upgrade: jp,
  nft: Mp
}, Rp = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", Dp = "0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab", Up = "0x1d3da001E586a7DEFD397B77FADB29eD6F039c13", Pp = "AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ", Vp = "5bmbJkDF9Z8EAkSbHeq2G7dXhPPjvFZ1gJ5yf5Jam4Pc", Fp = "EFmDHsBSjkydv26Ajc8pvR9GFuNNmubo9tPjfrnc6Eos", ze = {
  publicationDigest: Rp,
  bnbAdapter: Dp,
  bnbPass: Up,
  slotDigest: Pp,
  registrationDigest: Vp,
  suiConfigurationDigest: Fp
}, k = Object.freeze({ ...T, utilsPackage: "0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc", adapter: ze.bnbAdapter, pass: ze.bnbPass, peer: "0x" + ze.bnbAdapter.slice(2).toLowerCase().padStart(64, "0"), key: "nftree-original-sui-peer-v1-90b5292a", maxGasMist: 100000000n }), $e = (e, t) => {
  if (!e) throw Error(t);
}, B0 = (e) => e?.asMoveObject?.contents?.json, Za = (e) => btoa(String.fromCharCode(...e)), qa = (e) => Uint8Array.from(e.replace(/^0x/, "").match(/../g), (t) => parseInt(t, 16)), It = { bytes: Za(qa(k.peer)) }, $p = "00030100110100000000000000000000000000030d40", Ha = Za(qa($p)), sa = B0(be.oapp), Lp = B0(be.channel), Ht = h.u32().serialize(30102).toBytes(), zp = { peerEntry: [sa.peer.peers.id, "u32", Ht], reserveOptions: [sa.enforced_options.options.id, k.oappPackage + "::enforced_options::EnforcedOptionsKey", Uint8Array.from([...Ht, 1, 0])], ackOptions: [sa.enforced_options.options.id, k.oappPackage + "::enforced_options::EnforcedOptionsKey", Uint8Array.from([...Ht, 3, 0])], channelPath: [Lp.channels.id, k.endpointPackage + "::messaging_channel::ChannelKey", Uint8Array.from([...Ht, 32, ...qa(k.peer)])] }, Gp = (e) => {
  if (e === "u32") return { u32: null };
  const [t, n, a] = e.split("::");
  return { struct: { address: t, module: n, name: a, typeParams: [] } };
}, Y0 = Object.freeze(Object.fromEntries(Object.entries(zp).map(([e, [t, n, a]]) => [e, { parent: t, type: n, bcs: Za(a), id: Vt(t, Gp(n), a) }]))), Wp = Z8.slice(0, -1) + " " + Object.entries({ registry: k.registry, vaultAdmin: k.vaultAdmin, upgrade: k.upgrade, nft: k.nft }).map(([e, t]) => e + ':object(address:"' + t + '"){' + On + "}").join(" ") + " " + Object.entries(Y0).map(([e, t]) => e + ':address(address:"' + t.parent + '"){dynamicField(name:{type:"' + t.type + '",bcs:"' + t.bcs + '"}){value{... on MoveValue{json}}}}').join(" ") + "}", Qp = Wp.replaceAll(On, "...PeerObject") + " fragment PeerObject on Object {" + On + "}", Se = (e, t, n) => $e(se(e) === se(t), n);
function ka(e, t = 0) {
  $e(t === 0 || t === 1, "Unknown peer binding stage.");
  for (const a of ["oapp", "vault", "channel", "registry", "vaultAdmin", "upgrade", "nft"]) {
    const s = e[a], r = be[a];
    $e(s?.address === r.address, "Wrong " + a + " object."), Se(s.owner, r.owner, a + " ownership changed."), Se(s.asMoveObject?.contents?.type, r.asMoveObject.contents.type, a + " type changed.");
  }
  for (const a of ["registry", "vaultAdmin", "upgrade", "nft"]) Se(B0(e[a]), B0(be[a]), "Protected " + a + " contents changed.");
  for (const a of ["registry", "upgrade", "nft"])
    $e(String(e[a].version) === String(be[a].version) && e[a].digest === be[a].digest, "Protected " + a + " version/digest changed.");
  for (const a of ["oapp", "vault", "channel"]) {
    const s = structuredClone(B0(be[a]));
    t === 1 && (a === "oapp" ? (s.peer.peers.size = "1", s.enforced_options.options.size = "2") : a === "vault" ? (s.bound = !0, s.peer = It) : s.channels.size = "1"), Se(B0(e[a]), s, "Unexpected " + a + " peer state.");
  }
  const n = structuredClone(e);
  for (const a of ["oapp", "vault", "channel"]) n[a].asMoveObject.contents.json = structuredClone(B0(be[a]));
  bp(n, 1);
  for (const a of Object.keys(Y0)) $e(e[a] && Object.hasOwn(e[a], "dynamicField"), "Missing " + a + " lookup.");
  if (t === 0)
    for (const a of Object.keys(Y0)) $e(e[a].dynamicField === null, "Peer or enforced options already set. Check the binding receipt.");
  else {
    const a = (r) => e[r].dynamicField?.value?.json;
    Se(a("peerEntry"), It, "Wrong explicit BNB peer.");
    for (const r of ["reserveOptions", "ackOptions"]) Se(a(r), Ha, "Wrong " + r + " execution policy.");
    const s = a("channelPath");
    $e(s?.outbound_nonce === "0" && s?.lazy_inbound_nonce === "0" && s?.inbound_payload_hashes?.size === "0" && /^0x[0-9a-f]{64}$/.test(s?.inbound_payload_hashes?.id ?? "") && !/^0x0+$/.test(s.inbound_payload_hashes.id), "Channel already used or incorrect."), Se(Object.keys(s).sort(), ["inbound_payload_hashes", "lazy_inbound_nonce", "outbound_nonce"], "Unexpected channel fields."), Se(Object.keys(s.inbound_payload_hashes).sort(), ["id", "size"], "Unexpected inbound table fields.");
  }
  return e;
}
Object.freeze({ ...Be, key: "nftree-original-bnb-config-v1-90b5292a", maxAge: 12e4 });
const c0 = (e, t) => {
  if (!e) throw Error(t);
}, ur = (e, t, n) => c0(se(e) === se(t), n), Jp = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
function Yp(e, t) {
  c0(e?.toLowerCase() === k.sender, "Select the Sui dev wallet ending 45c4."), ka(t, 0);
  const n = new _n();
  n.setSender(k.sender);
  const a = n.moveCall({ target: k.utilsPackage + "::bytes32::from_address", arguments: [n.pure.address(k.peer)] });
  return n.moveCall({ target: k.package + "::vault::bind", typeArguments: [k.nftType], arguments: [n.sharedObjectRef({ objectId: k.vault, initialSharedVersion: "2", mutable: !0 }), n.objectRef({ objectId: k.vaultAdmin, version: String(t.vaultAdmin.version), digest: t.vaultAdmin.digest }), n.sharedObjectRef({ objectId: k.oapp, initialSharedVersion: "1", mutable: !0 }), n.objectRef({ objectId: k.admin, version: String(t.admin.version), digest: t.admin.digest }), n.sharedObjectRef({ objectId: k.endpoint, initialSharedVersion: "635685314", mutable: !1 }), n.sharedObjectRef({ objectId: k.channel, initialSharedVersion: k.channelVersion, mutable: !0 }), a] }), n;
}
const lr = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n));
function Zp(e) {
  c0(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Peer binding did not succeed.");
  const t = e.Transaction;
  c0(t.transaction?.sender === k.sender && t.transaction.gasData?.owner === k.sender, "Wrong sender or gas owner.");
  const n = t.transaction.inputs?.flatMap((p) => p.Object?.ImmOrOwnedObject ? [p.Object.ImmOrOwnedObject] : []);
  c0(n?.length === 2 && n.every((p) => [k.vaultAdmin, k.admin].includes(p.objectId) && /^[1-9][0-9]*$/.test(String(p.version)) && Jp.test(p.digest)) && new Set(n.map((p) => p.objectId)).size === 2, "Wrong admin object references.");
  const a = structuredClone(be);
  for (const p of n) Object.assign(a[p.objectId === k.vaultAdmin ? "vaultAdmin" : "admin"], { version: String(p.version), digest: p.digest });
  for (const p of Object.keys(Y0)) a[p] = { dynamicField: null };
  const s = Yp(k.sender, a).getData();
  for (const p of ["commands", "inputs"]) ur(lr(t.transaction[p]), lr(s[p]), "Only the exact original peer-binding " + p + " are allowed.");
  const r = [
    [k.endpointPackage + "::messaging_channel::ChannelInitializedEvent", { local_oapp: k.package, remote_eid: 30102, remote_oapp: It }],
    [k.oappPackage + "::oapp_peer::PeerSetEvent", { oapp: k.package, eid: 30102, peer: It }],
    ...[1, 3].map((p) => [k.oappPackage + "::enforced_options::EnforcedOptionSetEvent", { oapp: k.package, eid: 30102, msg_type: p, options: Ha }]),
    [k.package + "::vault::Bound", { vault: k.vault, peer: It }]
  ];
  ur(t.events?.map((p) => [p.eventType, p.json]), r, "Peer, channel or enforced-options events differ.");
  const i = t.effects?.changedObjects;
  c0(Array.isArray(i), "Missing binding effects.");
  const o = /* @__PURE__ */ new Map([[k.vault, "2"], [k.oapp, "1"], [k.channel, k.channelVersion]]), c = /* @__PURE__ */ new Set([k.vaultAdmin, k.admin]), u = /* @__PURE__ */ new Set([...o.keys(), ...c]), f = /* @__PURE__ */ new Set([t.effects.gasObject?.objectId, ...(t.transaction.gasData.payment ?? []).map((p) => p.objectId)]), l = /* @__PURE__ */ new Set();
  c0(!i.some((p) => [k.nft, k.registry, k.upgrade, k.endpoint, k.uln, k.registration].includes(p.objectId)), "Protected NFT, Registry, upgrade authority or protocol settings changed.");
  for (const p of i)
    if (p.inputState === "Exists")
      u.has(p.objectId) ? (l.add(p.objectId), c0(p.outputState === "ObjectWrite" && p.idOperation === "None", "Unexpected existing object operation."), c.has(p.objectId) ? c0(p.inputOwner?.AddressOwner === k.sender && p.outputOwner?.AddressOwner === k.sender, "Admin capability moved.") : c0(String(p.inputOwner?.Shared?.initialSharedVersion) === o.get(p.objectId) && String(p.outputOwner?.Shared?.initialSharedVersion) === o.get(p.objectId), "Shared ownership changed.")) : c0(f.has(p.objectId) && p.inputOwner?.AddressOwner === k.sender, "Unexpected existing object mutation.");
    else if (p.outputState === "ObjectWrite") {
      const y = Object.values(Y0).find((E) => E.id === p.objectId);
      c0(y && p.idOperation === "Created" && p.outputOwner?.ObjectOwner === y.parent, "Unexpected new binding entry.");
    } else c0(p.inputState === "DoesNotExist" && p.outputOwner === null && (p.outputState === "AccumulatorWriteV1" && p.idOperation === "None" || p.outputState === "DoesNotExist" && p.idOperation === "Created"), "Unexpected additional object effect.");
  c0(l.size === u.size, "Missing binding writes.");
  const b = i.filter((p) => p.inputState === "DoesNotExist" && p.outputState === "ObjectWrite");
  c0(b.length === 4 && Object.values(Y0).every((p) => b.some((y) => y.objectId === p.id)), "Expected exactly four derived binding entries."), c0(i.filter((p) => p.inputState === "DoesNotExist" && p.outputState === "DoesNotExist" && p.idOperation === "Created").length <= 3, "Unexpected transient object count.");
  const g = t.effects?.gasUsed;
  c0(g, "Missing gas effects.");
  const m = BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate);
  return c0(m > 0n && m <= k.maxGasMist, "Gas exceeds the reviewed 0.1-SUI estimate ceiling."), c0(t.balanceChanges?.length === 1 && t.balanceChanges[0].address === k.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -m, "Unexpected balance change."), { gasMist: String(m), channelId: k.channel, vaultId: k.vault, peer: k.peer, bindingEntries: Object.fromEntries(Object.entries(Y0).map(([p, y]) => [p, y.id])) };
}
async function qp(e) {
  I8(await e.core.getChainIdentifier({ signal: AbortSignal.timeout(3e4) }));
  const t = [[ze.publicationDigest, O8], [ze.slotDigest, j8], [ze.registrationDigest, V8], [ze.suiConfigurationDigest, pp]], n = await Promise.all(t.map(async ([a, s]) => {
    const r = await e.core.getTransaction({ digest: a, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
    return c0(r.Transaction?.digest === a, "Wrong source receipt."), s(r);
  }));
  return c0(n[0].packageId === k.package && n[1].vaultId === k.vault && n[2].channelId === k.channel && n[3].channelId === k.channel, "Confirmed source bindings differ."), { status: "verified" };
}
const Hp = {
  sequenceNumber: 346371773,
  timestamp: "2026-11-17T23:26:28.590Z"
}, Xp = {
  address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  version: 1089269257,
  digest: "H6f3o8W3vwRQ2piaKwAbMb123qVBPk9SR4UmhoKbzvm6",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685314
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
      },
      json: {
        id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        eid: 30378,
        call_cap: {
          id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
          cap_type: {
            "@variant": "Package",
            pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
          }
        },
        oapp_registry: {
          oapps: {
            id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
            size: "142"
          }
        },
        composer_registry: {
          composers: {
            id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
            size: "7"
          }
        },
        message_lib_manager: {
          registry: {
            libs: {
              contents: {
                id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                size: "2"
              }
            },
            lib_to_type: {
              id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
              size: "2"
            }
          },
          default_configs: {
            id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
            size: "126"
          },
          oapp_configs: {
            id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
            size: "100"
          }
        }
      }
    }
  }
}, Kp = {
  address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  version: 1089269257,
  digest: "AcckrdnV5VRmY8Ejt95EwQCMBFA7GFjwqpa5nmh3HuS9",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685319
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
      },
      json: {
        id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        call_cap: {
          id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
          cap_type: {
            "@variant": "Package",
            pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
          }
        },
        send_uln: {
          default_executor_configs: {
            id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
            size: "126"
          },
          default_uln_configs: {
            id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
            size: "126"
          },
          oapp_executor_configs: {
            id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
            size: "54"
          },
          oapp_uln_configs: {
            id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
            size: "214"
          }
        },
        receive_uln: {
          default_uln_configs: {
            id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
            size: "126"
          },
          oapp_uln_configs: {
            id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
            size: "239"
          },
          verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
        }
      }
    }
  }
}, e4 = {
  address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
  version: 1089269258,
  digest: "VdwgrsSrPBCt29tRR2sH7H7ut2YUA4Eb9L43idahLxL",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
      },
      json: {
        id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        oapp_cap: {
          id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
        peer: {
          peers: {
            id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
            size: "1"
          }
        },
        enforced_options: {
          options: {
            id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
            size: "2"
          }
        },
        sending_call: null
      }
    }
  }
}, t4 = {
  address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
  version: 1089269258,
  digest: "EjN4KdoP3XMuAzPQbEKnjQDuz2tP2K1orgagGtHyjaWb",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
      },
      json: {
        id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
      }
    }
  }
}, n4 = {
  address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
  version: 1089269258,
  digest: "FaDXyQYPnE5qVXcRhoUnLBjAGPxBq6cfPvBhD8ejQB36",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 2
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
      },
      json: {
        id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        version: "1",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        cap: {
          id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        nft: null,
        backing: {
          bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
        },
        route: {
          bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
        },
        peer: {
          bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
        },
        bound: !0,
        paused: !1,
        phase: 0,
        announced: !1,
        ack_sent: !1,
        request: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        recipient: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      }
    }
  }
}, a4 = {
  address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
  version: 1089269258,
  digest: "46iexvc4YCLGQNtXuiAVedwqGcnmbUzpMKJmUfm5YV2a",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1058683488
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
      },
      json: {
        id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        channels: {
          id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
          size: "1"
        },
        is_sending: !1
      }
    }
  }
}, s4 = {
  address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
  version: 1089269257,
  digest: "NVoFVPBULujFwR6gJrECtCiTS25JvWbTmd9LKuhMaR9",
  owner: {
    __typename: "ObjectOwner"
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
      },
      json: {
        id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
        name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        value: {
          messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp_info: "AAEceUXklt3krTFC6/jVK5WUb07TRDVo3vqbl97DB8D50QDwAQABAaxzByuU8UqHsjeBxwBMd99nmf3uEJ8kJx1GlrxKZRSkBXZhdWx0Cmx6X3JlY2VpdmUDAUW/CEmXhOqf9liTcWWpRJ1QmqN95HpyivROkDOH88osARx5ReSW3eStMULr+NUrlZRvTtNENWje+puX3sMHwPnRACBkICYW91pWFKz6JkQYJYUhKZ62qJLu7qOS/u+JSMfrUwFTMHhmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQAAAA=",
          delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    }
  }
}, r4 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, i4 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "5",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, o4 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "20",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, c4 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, d4 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, f4 = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "5",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, u4 = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "20",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, l4 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, b4 = {
  address: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
  version: 2,
  digest: "6dLNdxRWrpZdVjyq8YTqYq7bTvWQqnJVqx4qM3DPFD4y",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Registry"
      },
      json: {
        id: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        version: "1",
        cap: null,
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        slot: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        backing: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        nft_type: "ZjZjNmQ0MzllYTBkYTJmM2U5YmE3OWU0OTkyYTdhNGMxMTMyMTVmYmY1NGM0NDJhYzkwMjBjMzE1Zjk1MzcwNTo6Y29sbGVjdGlvbjo6TkZU"
      }
    }
  }
}, p4 = {
  address: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
  version: 1089269258,
  digest: "4Efe9yp7RFM7gCYFVrTAyGT9Ewt1z2aiKDZDCAetL5aj",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::AdminCap"
      },
      json: {
        id: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92"
      }
    }
  }
}, m4 = {
  address: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
  version: 1,
  digest: "BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"
      },
      json: {
        id: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
        package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        version: "1",
        policy: 0
      }
    }
  }
}, g4 = {
  address: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
  version: 986499448,
  digest: "HXroMY2h1sVdUcu71aVxXYiSEtEsGFmAEaNMVX8DscEt",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      },
      json: {
        id: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        number: "2720",
        name: "Tree NFT #2720",
        description: "A unique tree from the Tree NFT collection. Rarity: Common",
        image_url: "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",
        rarity: "Common"
      }
    }
  }
}, h4 = {
  dynamicField: {
    value: {
      json: {
        bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
      }
    }
  }
}, A4 = {
  dynamicField: {
    value: {
      json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
    }
  }
}, y4 = {
  dynamicField: {
    value: {
      json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
    }
  }
}, w4 = {
  dynamicField: {
    value: {
      json: {
        outbound_nonce: "0",
        lazy_inbound_nonce: "0",
        inbound_payload_hashes: {
          id: "0x861288a8c14221c0922c3a7acb5c341bfc4a0c94c5c528858e7a2e2b95ae669b",
          size: "0"
        }
      }
    }
  }
}, P0 = {
  checkpoint: Hp,
  endpoint: Xp,
  uln: Kp,
  oapp: e4,
  admin: t4,
  vault: n4,
  channel: a4,
  registration: s4,
  libraries: r4,
  send: i4,
  receive: o4,
  executor: c4,
  appLibraries: d4,
  appSend: f4,
  appReceive: u4,
  appExecutor: l4,
  registry: b4,
  vaultAdmin: p4,
  upgrade: m4,
  nft: g4,
  peerEntry: h4,
  reserveOptions: A4,
  ackOptions: y4,
  channelPath: w4
}, v4 = "FCG2538WHkd7rTAiC2McJanEw2Dr84BiaGcXoNzZUwsu", br = {
  suiPeerBindingDigest: v4
}, D = Object.freeze({ ...k, key: "nftree-original-deposit-v1-046da2a9", maxGasMist: 100000000n }), e0 = (e, t) => {
  if (!e) throw Error(t);
}, Ot = (e, t, n) => e0(se(e) === se(t), n), T4 = (e) => e instanceof Uint8Array ? e : Uint8Array.from(Object.values(e)), pr = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n)), Qo = () => ({ ...structuredClone(B0(P0.vault)), nft: structuredClone(B0(P0.nft)), phase: 1 });
function Jo(e, t = 0) {
  if (t === 0) return ka(e, 1);
  e0(t === 1, "Unknown deposit stage."), e0(e.vault?.address === D.vault, "Wrong deposit vault."), Ot(e.vault.owner, P0.vault.owner, "Vault ownership changed."), Ot(e.vault.asMoveObject?.contents?.type, P0.vault.asMoveObject.contents.type, "Wrong vault type."), Ot(B0(e.vault), Qo(), "Only original #2720 may be held in the funded, unannounced vault."), e0(e.nft === null, "Deposited NFT must be wrapped, not independently live.");
  const n = structuredClone(e);
  return n.vault.asMoveObject.contents.json = structuredClone(B0(P0.vault)), n.nft = structuredClone(P0.nft), ka(n, 1), e;
}
function I4(e, t) {
  e0(e?.toLowerCase() === D.sender, "Select the Sui dev wallet ending 45c4."), Jo(t, 0);
  const n = new _n();
  return n.setSender(D.sender), n.moveCall({ target: D.package + "::vault::fund", typeArguments: [D.nftType], arguments: [n.sharedObjectRef({ objectId: D.vault, initialSharedVersion: "2", mutable: !0 }), n.objectRef({ objectId: D.vaultAdmin, version: String(t.vaultAdmin.version), digest: t.vaultAdmin.digest }), n.objectRef({ objectId: D.nft, version: String(t.nft.version), digest: t.nft.digest })] }), n;
}
const O4 = h.struct("NFT", { id: h.Address, number: h.u64(), name: h.string(), description: h.string(), image_url: h.string(), rarity: h.string() }), E4 = h.struct("CallCap", { id: h.Address, cap_type: h.enum("CapType", { Individual: null, Package: h.Address }) }), S4 = h.struct("Vault", { id: h.Address, version: h.u64(), registry: h.Address, cap: E4, oapp: h.Address, nft: h.option(O4), backing: h.vector(h.u8()), route: h.vector(h.u8()), peer: h.vector(h.u8()), bound: h.bool(), paused: h.bool(), phase: h.u8(), announced: h.bool(), ack_sent: h.bool(), request: h.vector(h.u8()), recipient: h.vector(h.u8()) });
function k4() {
  const e = Qo();
  e.cap.cap_type = { Package: e.cap.cap_type.pos0 };
  for (const t of ["backing", "route", "peer", "request", "recipient"]) e[t] = Array.from(atob(e[t].bytes), (n) => n.charCodeAt(0));
  return S4.serialize(e).toBytes();
}
function N4(e, t, { quote: n = !1 } = {}) {
  e0(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Deposit simulation or receipt failed.");
  const a = e.Transaction;
  e0(a.transaction?.sender === D.sender && a.transaction.gasData?.owner === D.sender, "Wrong sender or gas owner.");
  for (const f of ["inputs", "commands"]) Ot(pr(a.transaction[f]), pr(t.getData()[f]), "Unexpected deposit " + f + ".");
  Ot(a.events?.map((f) => [f.eventType, f.json]), [[D.package + "::vault::Funded", { vault: D.vault, nft: B0(P0.vault).backing }]], "Expected exactly one original-NFT deposit event.");
  const s = a.effects?.changedObjects;
  e0(Array.isArray(s), "Missing deposit effects.");
  const r = /* @__PURE__ */ new Set([a.effects.gasObject?.objectId, ...(a.transaction.gasData.payment ?? []).map((f) => f.objectId)]), i = /* @__PURE__ */ new Set();
  for (const f of s)
    f.inputState === "Exists" ? f.objectId === D.nft ? (e0(f.outputState === "DoesNotExist" && f.idOperation === "None" && f.outputOwner === null && f.inputOwner?.AddressOwner === D.sender && String(f.inputVersion) === String(P0.nft.version) && f.inputDigest === P0.nft.digest, "NFT must be wrapped intact, not deleted or transferred."), i.add(D.nft)) : f.objectId === D.vault || f.objectId === D.vaultAdmin ? (e0(f.outputState === "ObjectWrite" && f.idOperation === "None", "Unexpected vault/admin operation."), f.objectId === D.vault ? e0(String(f.inputOwner?.Shared?.initialSharedVersion) === "2" && String(f.outputOwner?.Shared?.initialSharedVersion) === "2", "Vault must stay shared.") : e0(f.inputOwner?.AddressOwner === D.sender && f.outputOwner?.AddressOwner === D.sender, "Vault AdminCap must stay in the dev wallet."), i.add(f.objectId)) : e0(r.has(f.objectId) && f.inputOwner?.AddressOwner === D.sender && (!f.outputOwner || f.outputOwner?.AddressOwner === D.sender), "Unexpected existing-object mutation.") : e0(f.inputState === "DoesNotExist" && f.outputOwner === null && (f.outputState === "AccumulatorWriteV1" && f.idOperation === "None" || n && f.outputState === "DoesNotExist" && f.idOperation === "Created"), "Unexpected created object or additional effect.");
  e0(i.size === 3, "Missing NFT wrapping, vault or AdminCap effects.");
  const o = a.effects?.gasUsed;
  e0(o, "Missing gas usage.");
  const c = BigInt(o.computationCost) + BigInt(o.storageCost), u = c - BigInt(o.storageRebate);
  return e0(c > 0n && c <= D.maxGasMist && BigInt(a.transaction.gasData.budget) > 0n && BigInt(a.transaction.gasData.budget) <= D.maxGasMist, "Gas exceeds the reviewed 0.1-SUI ceiling."), e0(a.balanceChanges?.length === 1 && a.balanceChanges[0].address === D.sender && /^0x0*2::sui::SUI$/.test(a.balanceChanges[0].coinType) && BigInt(a.balanceChanges[0].amount) === -u, "Unexpected asset payment or balance change."), { gasMist: String(u), grossGasMist: String(c), vaultId: D.vault, nftId: D.nft };
}
function C4(e) {
  const t = e?.Transaction, n = t?.transaction?.inputs?.map((o) => o.Object?.ImmOrOwnedObject).filter(Boolean);
  e0(n?.length === 2, "Exactly NFT and matching admin inputs required.");
  const a = structuredClone(P0), s = n.find((o) => o.objectId === D.vaultAdmin), r = n.find((o) => o.objectId === D.nft);
  e0(s && r, "Wrong deposit inputs."), Object.assign(a.vaultAdmin, { version: String(s.version), digest: s.digest }), e0(String(r.version) === String(P0.nft.version) && r.digest === P0.nft.digest, "Original NFT reference changed.");
  const i = N4(e, I4(D.sender, a));
  if (e.commandResults) {
    const o = e.commandResults[0]?.mutatedReferences;
    e0(o?.length === 1, "Expected one mutated vault reference."), e0(Ae(T4(o[0].bcs)) === Ae(k4()), "Simulated vault must hold the full unchanged original NFT.");
  }
  return i;
}
dt(["function quote((uint32 dstEid,bytes32 receiver,bytes message,bytes options,bool payInLzToken) params,address sender) view returns ((uint256 nativeFee,uint256 lzTokenFee) fee)"]);
dt(["function redemptionOptions() view returns (bytes)"]);
async function x4(e) {
  await qp(e);
  const t = await e.core.getTransaction({ digest: br.suiPeerBindingDigest, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
  e0(t.Transaction?.digest === br.suiPeerBindingDigest, "Wrong peer receipt."), Zp(t);
}
const _4 = "GLXLAmCD3DrbdK55NXmppr7uPEWDdrYYF9JBd3C5XBvE", B4 = {
  checkpoint: {
    sequenceNumber: 346377185,
    timestamp: "2026-11-17T23:48:14.747Z"
  },
  endpoint: {
    address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
    version: 1089269257,
    digest: "H6f3o8W3vwRQ2piaKwAbMb123qVBPk9SR4UmhoKbzvm6",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 635685314
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
        },
        json: {
          id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
          eid: 30378,
          call_cap: {
            id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
            cap_type: {
              "@variant": "Package",
              pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
            }
          },
          oapp_registry: {
            oapps: {
              id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
              size: "142"
            }
          },
          composer_registry: {
            composers: {
              id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
              size: "7"
            }
          },
          message_lib_manager: {
            registry: {
              libs: {
                contents: {
                  id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                  size: "2"
                }
              },
              lib_to_type: {
                id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
                size: "2"
              }
            },
            default_configs: {
              id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
              size: "126"
            },
            oapp_configs: {
              id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
              size: "100"
            }
          }
        }
      }
    }
  },
  uln: {
    address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
    version: 1089269257,
    digest: "AcckrdnV5VRmY8Ejt95EwQCMBFA7GFjwqpa5nmh3HuS9",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 635685319
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
        },
        json: {
          id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
          call_cap: {
            id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
            cap_type: {
              "@variant": "Package",
              pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
            }
          },
          send_uln: {
            default_executor_configs: {
              id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
              size: "126"
            },
            default_uln_configs: {
              id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
              size: "126"
            },
            oapp_executor_configs: {
              id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
              size: "54"
            },
            oapp_uln_configs: {
              id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
              size: "214"
            }
          },
          receive_uln: {
            default_uln_configs: {
              id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
              size: "126"
            },
            oapp_uln_configs: {
              id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
              size: "239"
            },
            verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
          }
        }
      }
    }
  },
  oapp: {
    address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
    version: 1089269258,
    digest: "VdwgrsSrPBCt29tRR2sH7H7ut2YUA4Eb9L43idahLxL",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 1
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
        },
        json: {
          id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
          oapp_cap: {
            id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
            cap_type: {
              "@variant": "Package",
              pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
            }
          },
          admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
          peer: {
            peers: {
              id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
              size: "1"
            }
          },
          enforced_options: {
            options: {
              id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
              size: "2"
            }
          },
          sending_call: null
        }
      }
    }
  },
  admin: {
    address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
    version: 1089269258,
    digest: "EjN4KdoP3XMuAzPQbEKnjQDuz2tP2K1orgagGtHyjaWb",
    owner: {
      __typename: "AddressOwner",
      address: {
        address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
      }
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
        },
        json: {
          id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
        }
      }
    }
  },
  vault: {
    address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
    version: 1089269259,
    digest: "8JAvKTsZgLK7CmweNEbe5V4CWYEqGNPLWx4yqVXeF9hL",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 2
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
        },
        json: {
          id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
          version: "1",
          registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
          cap: {
            id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
            cap_type: {
              "@variant": "Package",
              pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
            }
          },
          oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
          nft: {
            id: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
            number: "2720",
            name: "Tree NFT #2720",
            description: "A unique tree from the Tree NFT collection. Rarity: Common",
            image_url: "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",
            rarity: "Common"
          },
          backing: {
            bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
          },
          route: {
            bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
          },
          peer: {
            bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
          },
          bound: !0,
          paused: !1,
          phase: 1,
          announced: !1,
          ack_sent: !1,
          request: {
            bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
          },
          recipient: {
            bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
          }
        }
      }
    }
  },
  channel: {
    address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
    version: 1089269258,
    digest: "46iexvc4YCLGQNtXuiAVedwqGcnmbUzpMKJmUfm5YV2a",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 1058683488
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
        },
        json: {
          id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
          channels: {
            id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
            size: "1"
          },
          is_sending: !1
        }
      }
    }
  },
  registration: {
    address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
    version: 1089269257,
    digest: "NVoFVPBULujFwR6gJrECtCiTS25JvWbTmd9LKuhMaR9",
    owner: {
      __typename: "ObjectOwner"
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
        },
        json: {
          id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
          name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
          value: {
            messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
            oapp_info: "AAEceUXklt3krTFC6/jVK5WUb07TRDVo3vqbl97DB8D50QDwAQABAaxzByuU8UqHsjeBxwBMd99nmf3uEJ8kJx1GlrxKZRSkBXZhdWx0Cmx6X3JlY2VpdmUDAUW/CEmXhOqf9liTcWWpRJ1QmqN95HpyivROkDOH88osARx5ReSW3eStMULr+NUrlZRvTtNENWje+puX3sMHwPnRACBkICYW91pWFKz6JkQYJYUhKZ62qJLu7qOS/u+JSMfrUwFTMHhmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQAAAA=",
            delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
          }
        }
      }
    }
  },
  libraries: {
    dynamicField: {
      value: {
        json: {
          send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib_timeout: null
        }
      }
    }
  },
  send: {
    dynamicField: {
      value: {
        json: {
          confirmations: "5",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
            "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  },
  receive: {
    dynamicField: {
      value: {
        json: {
          confirmations: "20",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
            "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  },
  executor: {
    dynamicField: {
      value: {
        json: {
          max_message_size: "10000",
          executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
        }
      }
    }
  },
  appLibraries: {
    dynamicField: {
      value: {
        json: {
          send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib_timeout: null
        }
      }
    }
  },
  appSend: {
    dynamicField: {
      value: {
        json: {
          use_default_confirmations: !1,
          use_default_required_dvns: !1,
          use_default_optional_dvns: !1,
          uln_config: {
            confirmations: "5",
            required_dvns: [
              "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
              "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
              "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
            ],
            optional_dvns: [],
            optional_dvn_threshold: 0
          }
        }
      }
    }
  },
  appReceive: {
    dynamicField: {
      value: {
        json: {
          use_default_confirmations: !1,
          use_default_required_dvns: !1,
          use_default_optional_dvns: !1,
          uln_config: {
            confirmations: "20",
            required_dvns: [
              "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
              "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
              "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
            ],
            optional_dvns: [],
            optional_dvn_threshold: 0
          }
        }
      }
    }
  },
  appExecutor: {
    dynamicField: {
      value: {
        json: {
          max_message_size: "10000",
          executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
        }
      }
    }
  },
  registry: {
    address: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
    version: 2,
    digest: "6dLNdxRWrpZdVjyq8YTqYq7bTvWQqnJVqx4qM3DPFD4y",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 1
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Registry"
        },
        json: {
          id: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
          version: "1",
          cap: null,
          oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
          slot: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
          backing: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
          nft_type: "ZjZjNmQ0MzllYTBkYTJmM2U5YmE3OWU0OTkyYTdhNGMxMTMyMTVmYmY1NGM0NDJhYzkwMjBjMzE1Zjk1MzcwNTo6Y29sbGVjdGlvbjo6TkZU"
        }
      }
    }
  },
  vaultAdmin: {
    address: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
    version: 1089269259,
    digest: "A758B4i9XqbdKhwVN6PSjnparfSibfkavtjVViozekEH",
    owner: {
      __typename: "AddressOwner",
      address: {
        address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
      }
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::AdminCap"
        },
        json: {
          id: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
          registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92"
        }
      }
    }
  },
  upgrade: {
    address: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
    version: 1,
    digest: "BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH",
    owner: {
      __typename: "AddressOwner",
      address: {
        address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
      }
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"
        },
        json: {
          id: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
          package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
          version: "1",
          policy: 0
        }
      }
    }
  },
  nft: null,
  peerEntry: {
    dynamicField: {
      value: {
        json: {
          bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
        }
      }
    }
  },
  reserveOptions: {
    dynamicField: {
      value: {
        json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
      }
    }
  },
  ackOptions: {
    dynamicField: {
      value: {
        json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
      }
    }
  },
  channelPath: {
    dynamicField: {
      value: {
        json: {
          outbound_nonce: "0",
          lazy_inbound_nonce: "0",
          inbound_payload_hashes: {
            id: "0x861288a8c14221c0922c3a7acb5c341bfc4a0c94c5c528858e7a2e2b95ae669b",
            size: "0"
          }
        }
      }
    }
  }
}, Yo = {
  digest: _4,
  currentSuiState: B4
}, j4 = 2, M4 = "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", R4 = null, D4 = {
  budget: null,
  price: null,
  owner: null,
  payment: null
}, U4 = [
  {
    Object: {
      SharedObject: {
        objectId: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        initialSharedVersion: "2",
        mutable: !0
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        initialSharedVersion: "1",
        mutable: !0
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        initialSharedVersion: "635685314",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        initialSharedVersion: "635685319",
        mutable: !1
      }
    }
  },
  {
    Pure: {
      bytes: "QSVZBAAAAAA="
    }
  },
  {
    Pure: {
      bytes: "AQ=="
    }
  },
  {
    Pure: {
      bytes: "AA=="
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        initialSharedVersion: "1058683488",
        mutable: !0
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x52e0e092bf361557c68bd3b1c370b9c102dc834d874624d910e1656ebc08bedc",
        initialSharedVersion: "635685308",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x5f24ef7da5e93ca930bf3270468bc2268e84cc83e52c129ea3311b0d5df50c8e",
        initialSharedVersion: "635685317",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x05195518fab7b80e60bc7df11cf791d8658c614e7ed401fc768db77e744e70b3",
        initialSharedVersion: "635685318",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x492ac62cfb43eb1e858a877cf7a0cf396bf38bc1420c727c747ecc19cf9f4e5c",
        initialSharedVersion: "635685308",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0xb6c5e08243222eb0bf95e98c66d26c628f7e0752b7272165d9e7867ff69c36a4",
        initialSharedVersion: "641876028",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x7f7ded52a6073633f8d642458b7899b0eaa7cd1ed7fb8098bd61730853afd3f7",
        initialSharedVersion: "635685317",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0xff718d782c8881e9bcdca063c1e7999c77ee22d7cc6b34c84d5f6f4c2654f7da",
        initialSharedVersion: "635685316",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x1ab2f88e12bece2a39addc97cef895e48e0ed97d03eaa9bd2fa943ab4dd7300e",
        initialSharedVersion: "641875710",
        mutable: !1
      }
    }
  },
  {
    Pure: {
      bytes: "SFlT4urfSqAq+VDPjpFPvStnUjOF5zw2EYNBRZ2NRcQ="
    }
  }
], P4 = [
  {
    SplitCoins: {
      coin: {
        GasCoin: !0
      },
      amounts: [
        {
          Input: 4
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
      module: "vault",
      function: "send",
      typeArguments: [
        "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      ],
      arguments: [
        {
          Input: 0
        },
        {
          Input: 1
        },
        {
          Input: 5
        },
        {
          Input: 6
        },
        {
          NestedResult: [
            0,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
      module: "endpoint_v2",
      function: "send",
      typeArguments: [],
      arguments: [
        {
          Input: 2
        },
        {
          Input: 7
        },
        {
          Result: 1
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
      module: "uln_302",
      function: "send",
      typeArguments: [],
      arguments: [
        {
          Input: 3
        },
        {
          NestedResult: [
            2,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x011da80425fb389d1090743a2a33a48c479f4fd218a25db2cdc072b768a47ce5",
      module: "executor_worker",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 9
        },
        {
          NestedResult: [
            3,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x63e8c59b39720d833bffca2f50e51e48ef426ac0c6ab8e92cf6475c42f5bd24e",
      module: "executor_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 10
        },
        {
          NestedResult: [
            4,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            5,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x63e8c59b39720d833bffca2f50e51e48ef426ac0c6ab8e92cf6475c42f5bd24e",
      module: "executor_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 10
        },
        {
          NestedResult: [
            4,
            0
          ]
        },
        {
          NestedResult: [
            5,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x011da80425fb389d1090743a2a33a48c479f4fd218a25db2cdc072b768a47ce5",
      module: "executor_worker",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 9
        },
        {
          NestedResult: [
            3,
            0
          ]
        },
        {
          NestedResult: [
            4,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 12
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            9,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            10,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            9,
            0
          ]
        },
        {
          NestedResult: [
            10,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 12
        },
        {
          NestedResult: [
            3,
            1
          ]
        },
        {
          NestedResult: [
            9,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 14
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            14,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            15,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            14,
            0
          ]
        },
        {
          NestedResult: [
            15,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 14
        },
        {
          NestedResult: [
            3,
            1
          ]
        },
        {
          NestedResult: [
            14,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 15
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            19,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            20,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            19,
            0
          ]
        },
        {
          NestedResult: [
            20,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 15
        },
        {
          NestedResult: [
            3,
            1
          ]
        },
        {
          NestedResult: [
            19,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
      module: "uln_302",
      function: "confirm_send",
      typeArguments: [],
      arguments: [
        {
          Input: 3
        },
        {
          Input: 2
        },
        {
          Input: 8
        },
        {
          Input: 7
        },
        {
          Result: 1
        },
        {
          NestedResult: [
            2,
            0
          ]
        },
        {
          NestedResult: [
            3,
            0
          ]
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
      module: "vault",
      function: "confirm_send",
      typeArguments: [
        "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      ],
      arguments: [
        {
          Input: 0
        },
        {
          Input: 1
        },
        {
          Result: 1
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
      module: "endpoint_send",
      function: "destroy",
      typeArguments: [],
      arguments: [
        {
          NestedResult: [
            25,
            0
          ]
        }
      ]
    }
  },
  {
    TransferObjects: {
      objects: [
        {
          NestedResult: [
            26,
            0
          ]
        }
      ],
      address: {
        Input: 16
      }
    }
  },
  {
    MoveCall: {
      package: "0x0000000000000000000000000000000000000000000000000000000000000001",
      module: "option",
      function: "destroy_none",
      typeArguments: [
        "0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin<0x3de1504cf3fd75762759e353d9d95389618e557d0552697f19b52e4e927c1dee::zro::ZRO>"
      ],
      arguments: [
        {
          NestedResult: [
            26,
            1
          ]
        }
      ]
    }
  }
], V4 = {
  version: j4,
  sender: M4,
  expiration: R4,
  gasData: D4,
  inputs: U4,
  commands: P4
}, mr = "0x" + "0".repeat(64), En = ae(Rt(["uint64", "uint32", "bytes32", "uint32", "bytes32"], [1n, 30378, D.package, 30102, D.peer])), B = Object.freeze({ ...D, key: "nftree-original-reserve-v1-8e133122", guid: En, maxFeeMist: 500000000n, maxGasMist: 100000000n, executorPayee: "0xf99b445ae678d3f28fe7acb91e5d7ee8ab538d7e231a837b12c593fb624ad630", dvnPayee: "0x9004e1e4c6dcc42d1b73269db48d510192665677fcad2079a3c7d1e9e971d34e" }), F4 = D0(["0x0201", B.vault, B.nft, mr, mr]), $4 = D0([Rt(["uint8", "uint64", "uint32", "bytes32", "uint32", "bytes32"], [1, 1n, 30378, B.package, 30102, B.peer]), En, F4]), M = (e, t) => {
  if (!e) throw Error(t);
}, Ge = (e, t, n) => M(se(e) === se(t), n), Zo = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/, gr = (e) => btoa(String.fromCharCode(...Uint8Array.from(e.slice(2).match(/../g), (t) => parseInt(t, 16)))), Xt = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n));
function qo(e, t = 0) {
  M(t === 0 || t === 1, "Unknown announcement stage."), M(B0(e.vault)?.announced === (t === 1), "Announcement already sent or not yet reflected. Check its receipt."), M(e.channelPath?.dynamicField?.value?.json?.outbound_nonce === String(t), "Unexpected announcement nonce.");
  const n = structuredClone(e);
  return n.vault.asMoveObject.contents.json.announced = !1, n.channelPath.dynamicField.value.json.outbound_nonce = "0", Jo(n, 1), e;
}
async function L4(e, t = 0) {
  const n = await e.query({ query: Qp, signal: AbortSignal.timeout(3e4) });
  return M(!n.errors && n.data, "Cannot verify NFT backing and announcement state."), qo(n.data, t);
}
async function z4(e) {
  await x4(e);
  const t = Yo.digest, n = await e.core.getTransaction({ digest: t, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
  M(n.Transaction?.digest === t, "Wrong original deposit receipt."), C4(n);
}
function G4(e, t, n, a) {
  M(t?.toLowerCase() === B.sender, "Select the Sui dev wallet ending 45c4."), qo(n, 0), M(e === "send", "Unknown announcement action.");
  const s = structuredClone(V4);
  {
    const r = BigInt(a);
    M(r > 0n && r <= B.maxFeeMist, "Message fee exceeds the reviewed 0.5-SUI ceiling."), s.inputs[4] = { Pure: { bytes: h.u64().serialize(r).toBase64() } };
  }
  return _n.from(JSON.stringify(s));
}
function W4(e, t, n) {
  M(e?.$kind === "Transaction" && e.Transaction?.status?.success === !0, "Announcement " + n + " did not succeed.");
  const a = e.Transaction;
  M(a.transaction?.sender === B.sender && a.transaction.gasData?.owner === B.sender, "Wrong sender or gas owner.");
  for (const l of ["commands", "inputs"]) Ge(Xt(a.transaction[l]), Xt(t.getData()[l]), "Exact announcement " + l + " differ.");
  const s = a.effects?.gasUsed;
  M(s, "Missing gas effects.");
  const r = BigInt(s.computationCost) + BigInt(s.storageCost), i = r - BigInt(s.storageRebate);
  M(r > 0n && r <= B.maxGasMist && i >= 0n && BigInt(a.transaction.gasData.budget) > 0n && BigInt(a.transaction.gasData.budget) <= B.maxGasMist, "Gas exceeds the reviewed 0.1-SUI ceiling.");
  const o = a.effects?.changedObjects;
  M(Array.isArray(o), "Missing object effects.");
  const c = /* @__PURE__ */ new Set([a.effects.gasObject?.objectId, ...(a.transaction.gasData.payment ?? []).map((l) => l.objectId)]), u = /* @__PURE__ */ new Map([[B.vault, "2"], [B.oapp, "1"], [B.channel, B.channelVersion]]), f = /* @__PURE__ */ new Set();
  for (const l of o)
    if (l.inputState === "Exists") {
      if (c.has(l.objectId)) {
        M(l.inputOwner?.AddressOwner === B.sender && (!l.outputOwner || l.outputOwner.AddressOwner === B.sender), "Gas must belong to the dev wallet.");
        continue;
      }
      M(n === "send", "Quote must not mutate custody or security."), f.add(l.objectId), M(l.outputState === "ObjectWrite" && l.idOperation === "None", "Unexpected announcement object operation."), u.has(l.objectId) ? (M(String(l.inputOwner?.Shared?.initialSharedVersion) === u.get(l.objectId), "Wrong shared object."), Ge(Xt(l.inputOwner), Xt(l.outputOwner), "Shared ownership changed.")) : M(l.objectId === Y0.channelPath.id && l.inputOwner?.ObjectOwner === Y0.channelPath.parent && l.outputOwner?.ObjectOwner === Y0.channelPath.parent, "Unexpected existing-object mutation.");
    } else l.outputState === "ObjectWrite" ? M(l.idOperation === "Created" && /^0x0*2::coin::Coin<0x0*2::sui::SUI>$/.test(a.objectTypes?.[l.objectId] ?? "") && [B.sender, B.executorPayee, B.dvnPayee].includes(l.outputOwner?.AddressOwner), "Unexpected created object, currency or recipient.") : M(l.inputState === "DoesNotExist" && l.outputOwner === null && (l.outputState === "AccumulatorWriteV1" && l.idOperation === "None" || l.outputState === "DoesNotExist" && l.idOperation === "Created"), "Unexpected additional object effect.");
  return Ge([...f].sort(), [...u.keys(), Y0.channelPath.id].sort(), "Expected exactly vault, OApp, channel and outbound-path writes."), { t: a, gas: i };
}
function Q4(e, t, n) {
  const { t: a, gas: s } = W4(e, t, "send"), r = BigInt(n);
  M(r > 0n && r <= B.maxFeeMist, "Unsupported message fee."), M(a.events?.length === 3, "Exactly executor/DVN fee and packet events required.");
  const [i, o, c] = a.events;
  M(i.eventType === B.ulnPackage + "::send_uln::ExecutorFeePaidEvent" && o.eventType === B.ulnPackage + "::send_uln::DVNFeePaidEvent" && i.json.executor === B.executor, "Wrong fee events or executor."), Ge(i.json.guid, { bytes: gr(En) }, "Wrong executor GUID."), Ge(o.json.guid, i.json.guid, "Wrong verifier GUID."), Ge(o.json.dvns, B.dvns, "Wrong required verifier set."), M(o.json.fees?.length === 3, "Exactly three required DVNs expected.");
  const u = [i.json.fee, ...o.json.fees];
  M(i.json.fee.recipient === B.executorPayee && o.json.fees.every((l) => l.recipient === B.dvnPayee), "Fee recipient changed."), M(u.every((l) => BigInt(l.fee) >= 0n) && u.reduce((l, b) => l + BigInt(b.fee), 0n) === r, "Worker fees do not equal the quoted payment."), Ge([c.eventType, c.json], [B.endpointPackage + "::messaging_channel::PacketSentEvent", { encoded_packet: gr($4), options: Ha, send_library: B.ulnPackage }], "Wrong packet, source identity, recipient, nonce, payload or delivery options.");
  const f = /* @__PURE__ */ new Map([[B.sender, -r - s]]);
  for (const l of u) f.set(l.recipient, (f.get(l.recipient) ?? 0n) + BigInt(l.fee));
  M(a.balanceChanges?.length === f.size, "Unexpected payment balances.");
  for (const l of a.balanceChanges)
    M(/^0x0*2::sui::SUI$/.test(l.coinType) && f.get(l.address) === BigInt(l.amount), "Unexpected payment recipient, currency or amount."), f.delete(l.address);
  return M(!f.size, "Missing payment balance."), { feeMist: String(r), gasMist: String(s), totalMist: String(r + s), guid: En, vaultId: B.vault, nftId: B.nft };
}
function J4(e) {
  const t = JSON.parse(e.getItem(B.key) || "null");
  return M(!t || Zo.test(t.digest), "Stored receipt is invalid. Check Slush activity."), { pending: e.getItem(B.key + "-pending") === "1", receipt: t };
}
function Y4(e, t) {
  const n = JSON.stringify(t);
  e.setItem(B.key, n), M(e.getItem(B.key) === n, "Cannot save the announcement receipt. Copy it from Slush."), e.removeItem(B.key + "-pending");
}
async function Z4(e, { storage: t, client: n = Fo(), now: a = Date.now } = {}) {
  M(Zo.test(e), "Enter the Sui announcement digest from Slush.");
  const s = J4(t).receipt;
  M(!s || s.digest === e, "A different announcement is recorded."), await z4(n);
  const r = await n.core.getTransaction({ digest: e, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
  M(r.Transaction?.digest === e, "Wrong announcement receipt.");
  const i = r.Transaction.transaction?.inputs?.[4]?.Pure?.bytes;
  M(i, "Missing fee input.");
  const o = BigInt(h.u64().parse(Uint8Array.from(atob(i), (l) => l.charCodeAt(0)))), c = G4("send", B.sender, Yo.currentSuiState, o), u = Q4(r, c, o);
  await L4(n, 1);
  const f = { digest: e, network: "sui:mainnet", sender: B.sender, status: "chain_verified", ...u, destinationStatus: "not_yet_verified", verifiedAt: new Date(a()).toISOString() };
  return Y4(t, f), f;
}
const K0 = Object.freeze({ ...Be, key: "nftree-original-enable-v1-1d3da001", announcement: "97udy89UfnUqZpTynesymkgSLrt3b61o5qZoMTgPUweK" });
De({ abi: Sn.contracts.TreeSuitePass.abi, functionName: "setPurchasesPaused", args: [!1] });
Object.freeze({ address: K0.pass, topics: Object.freeze([ae(R0("PurchasePauseChanged(bool)"))]), data: R0(0n, { size: 32 }) });
const q4 = (e, t) => {
  if (!e) throw Error(t);
}, hr = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase();
async function Ho(e = Fo()) {
  const t = /* @__PURE__ */ new Map(), n = { getItem: (s) => t.get(s) ?? null, setItem: (s, r) => t.set(s, r), removeItem: (s) => t.delete(s) }, a = await Z4(K0.announcement, { client: e, storage: n });
  return q4(a.status === "chain_verified" && hr(a.vaultId, K0.route) && hr(a.nftId, K0.nft), "Original backing announcement is not verified."), a;
}
const H4 = "0x38", X4 = "0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae", K4 = "0x1d3da001E586a7DEFD397B77FADB29eD6F039c13", e3 = "0x55d398326f99059ff775485246999027b3197955", t3 = "0xc440f06bbc7e58b0d055815f915447e4ae0e3720", n3 = "25000000000000000000", a3 = "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", s3 = "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c", r3 = {
  reset: {
    label: "Reset the existing USDT allowance to zero",
    to: "0x55d398326f99059ff775485246999027b3197955",
    data: "0x095ea7b30000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c130000000000000000000000000000000000000000000000000000000000000000",
    events: [
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13"
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000000000"
      }
    ]
  },
  approve: {
    label: "Approve exactly 25 USDT for the pilot pass",
    to: "0x55d398326f99059ff775485246999027b3197955",
    data: "0x095ea7b30000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c130000000000000000000000000000000000000000000000015af1d78b58c40000",
    events: [
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13"
        ],
        data: "0x0000000000000000000000000000000000000000000000015af1d78b58c40000"
      }
    ]
  },
  buy: {
    label: "Buy the original-backed pass for 25 USDT",
    to: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
    data: "0xa6f2ae3a",
    events: [
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x000000000000000000000000c440f06bbc7e58b0d055815f915447e4ae0e3720"
        ],
        data: "0x0000000000000000000000000000000000000000000000015af1d78b58c40000"
      },
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13"
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
      {
        address: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000000000000000000000000000000000000000000001"
        ],
        data: "0x"
      },
      {
        address: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
        topics: [
          "0x4d81376e817f538bfc3647b67ca726bb2e4bd2cd7a79a7b5da522df6a15e2585",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae"
        ],
        data: "0x0000000000000000000000000000000000000000000000015af1d78b58c40000"
      }
    ]
  }
}, le = {
  chainId: H4,
  from: X4,
  pass: K4,
  currency: e3,
  treasury: t3,
  price: n3,
  nft: a3,
  route: s3,
  steps: r3
}, Xa = (e) => (e && typeof e == "object" && (Object.values(e).forEach(Xa), Object.freeze(e)), e), S0 = Xa({ ...K0, key: "nftree-original-purchase-v1-1d3da001", enablement: "0xbed02845217412a516a77167a9cf1d2edec25965c6d9568d2c096b8ca1c26830" }), Ar = Xa(le.steps), Xo = (e, t) => {
  if (!e) throw Error(t);
}, Ne = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase();
Xo(Ne(le.pass, S0.pass) && Ne(le.from, S0.from) && Ne(le.currency, S0.currency) && Ne(le.treasury, S0.treasury) && le.price === S0.price && le.chainId === S0.chainId && Ne(le.nft, S0.nft) && Ne(le.route, S0.route), "Purchase plan identity changed.");
const i3 = dt(["function approve(address spender,uint256 amount)", "function buy()"]);
for (const [e, t, n, a] of [["reset", S0.currency, "approve", [S0.pass, 0n]], ["approve", S0.currency, "approve", [S0.pass, BigInt(S0.price)]], ["buy", S0.pass, "buy", []]])
  Xo(Ne(Ar[e].to, t) && Ne(Ar[e].data, De({ abi: i3, functionName: n, args: a })), "Purchase target, spender or amount changed.");
const Ka = (e) => (e && typeof e == "object" && (Object.values(e).forEach(Ka), Object.freeze(e)), e), Ko = "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", o3 = ae(st([{ type: "uint8" }, { type: "uint256" }, { type: "address" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }, { type: "bytes32" }], [2, 56n, K0.pass, K0.route, K0.nft, 1n, K0.from, Ko])), C = Ka({ ...K0, key: "nftree-original-redemption-lock-v1-1d3da001", recipient: Ko, request: o3, maxFeeWei: "6000000000000000", purchase: "0x2a98b797478a92ca5000038208b6e9ea2746889bfff87fc8e64243ccd77552c5" }), es = Rt(["uint8", "uint8", "bytes32", "bytes32", "bytes32", "bytes32"], [2, 2, C.route, C.nft, C.request, C.recipient]), ts = "0x00030100110100000000000000000000000001c9c380", u0 = (e, t) => {
  if (!e) throw Error(t);
}, _0 = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase(), c3 = (e) => /^0x[0-9a-f]{64}$/i.test(e ?? ""), ht = Ka({ lock: { label: "Lock pass #1 for Sui wallet ending 45c4", to: C.pass, data: De({ abi: dt(["function requestRedemption(bytes32 suiRecipient) returns (bytes32)"]), functionName: "requestRedemption", args: [C.recipient] }), events: [{ address: C.pass, topics: [ae(R0("RedemptionRequested(bytes32,bytes32,bytes32)")), C.request, C.nft], data: C.recipient }] } }), d3 = { to: C.endpoint, data: De({ abi: dt(["function quote((uint32 dstEid,bytes32 receiver,bytes message,bytes options,bool payInLzToken) params,address sender) view returns ((uint256 nativeFee,uint256 lzTokenFee))"]), functionName: "quote", args: [{ dstEid: 30378, receiver: C.peer, message: es, options: ts, payInLzToken: !1 }, C.adapter] }) };
async function ke(e, t, n, a = [], s = [], r = "latest") {
  return r0(e, { method: "eth_call", params: [{ to: t, data: De({ abi: [{ type: "function", name: n, inputs: a, outputs: [], stateMutability: "view" }], functionName: n, args: s }) }, r] });
}
function f3({ passState: e, allowance: t, passBalance: n, canPlay: a, owner: s }) {
  return u0(t === "0" && n === "1" && _0(s, C.from), "Original pass ownership or zero remaining allowance changed."), e === "2" ? (u0(a === "1", "Active access check changed."), "lock") : (u0(e === "3" && a === "0", "Original pass is not locked for redemption."), "complete");
}
async function u3(e, { source: t = Ho } = {}) {
  await we(e, C), await t();
  const n = await r0(e, { method: "eth_blockNumber" });
  U(n, "BNB block");
  const a = U(await ke(e, C.pass, "state", [], [], n));
  u0(a === 2n || a === 3n, "The original pass is not Active or Locked.");
  for (const [p, y] of [[C.adapter, Lo()], [C.pass, zo()]])
    u0(_0(await r0(e, { method: "eth_getCode", params: [p, n] }), y), "Original contract runtime or immutable bindings changed.");
  for (const [p, y] of Object.entries({ ...kt.code, [C.currency]: C.currencySha256 }))
    u0(await $o(await r0(e, { method: "eth_getCode", params: [p, n] })) === y, "Protocol or currency runtime changed.");
  for (const p of kt.reads) {
    const y = await r0(e, { method: "eth_call", params: [{ to: p.to, data: p.data }, n] });
    u0(_0(y, p.label === "Pass state" ? R0(a, { size: 32 }) : p.after), "LayerZero " + p.label + " differs from the verified Ready route.");
  }
  const s = [["initialBuyer", BigInt(C.from)], ["controller", BigInt(C.from)], ["route", BigInt(C.route)], ["currency", BigInt(C.currency)], ["treasury", BigInt(C.treasury)], ["PRICE", BigInt(C.price)], ["TOKEN_ID", 1n], ["backingNFT", BigInt(C.nft)], ["state", a], ["redemption", a === 3n ? BigInt(C.request) : 0n], ["recipient", a === 3n ? BigInt(C.recipient) : 0n]];
  for (const [p, y] of s) u0(U(await ke(e, C.pass, p, [], [], n)) === y, "Original pass " + p + " changed.");
  for (const [p, y] of [["suiPeer", BigInt(C.peer)], ["route", BigInt(C.route)], ["backingNFT", BigInt(C.nft)], ["binder", BigInt(C.from)], ["redemptionGas", 30000000n], ["redemptionSent", 0n]])
    u0(U(await ke(e, C.adapter, p, [], [], n)) === y, "Original adapter " + p + " changed.");
  u0(U(await ke(e, C.currency, "decimals", [], [], n)) === 18n, "BNB USDT decimals changed."), u0(U(await ke(e, C.endpoint, "eid", [], [], n)) === 30102n, "Wrong BNB endpoint.");
  const r = async (p, y, E = [], w = []) => U(await ke(e, p, y, E, w, n)), i = [{ name: "owner", type: "address" }], o = [C.from], c = String(await r(C.currency, "balanceOf", i, o)), u = String(await r(C.currency, "allowance", [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], [C.from, C.pass])), f = String(await r(C.pass, "balanceOf", i, o)), l = String(await r(C.pass, "canPlay", i, o)), b = await r(C.pass, "purchasesPaused");
  u0(b === 0n, "The original purchase is paused.");
  let g;
  if (a === 2n || a === 3n) {
    const p = await ke(e, C.pass, "ownerOf", [{ name: "tokenId", type: "uint256" }], [1n], n);
    u0(/^0x0{24}[0-9a-f]{40}$/i.test(p), "Invalid pass owner."), g = "0x" + p.slice(-40);
  }
  const m = { block: n, passState: String(a), tokenBalance: c, allowance: u, passBalance: f, canPlay: l, owner: g };
  return u0(U(await ke(e, C.endpoint, "outboundNonce", [{ name: "sender", type: "address" }, { name: "dstEid", type: "uint32" }, { name: "receiver", type: "bytes32" }], [C.adapter, 30378, C.peer], n)) === 0n, "A redemption message already exists. Verify delivery before using this lock-only page."), { ...m, action: f3(m) };
}
async function l3(e, t, { read: n = u3 } = {}) {
  u0(c3(t), "Enter a BNB redemption-step transaction hash."), await we(e, C);
  const a = await r0(e, { method: "eth_getTransactionReceipt", params: [t] });
  if (!a) return { status: "pending", hash: t };
  u0(_0(a.transactionHash, t) && U(a.status) === 1n && _0(a.from, C.from) && a.contractAddress === null, "Wrong or failed redemption receipt.");
  const s = await r0(e, { method: "eth_getTransactionByHash", params: [t] });
  u0(s && _0(s.hash, t) && _0(s.from, C.from) && U(s.chainId) === 56n && U(s.value) === 0n, "Wrong redemption transaction identity.");
  const r = Object.keys(ht).find((c) => _0(s.to, ht[c].to) && _0(s.input, ht[c].data));
  u0(r && _0(a.to, ht[r].to), "Pass target, fixed recipient or lock calldata differs from review.");
  const i = ht[r];
  u0(a.logs?.length === i.events.length && i.events.every((c, u) => {
    const f = a.logs[u];
    return _0(f.address, c.address) && _0(f.data, c.data) && f.removed !== !0 && f.topics?.length === c.topics.length && c.topics.every((l, b) => _0(l, f.topics[b]));
  }), "Exact redemption request, original NFT or fixed recipient event differs.");
  const o = await n(e);
  return u0(o.action === "complete", "Current pass or allowance does not reflect this receipt."), await we(e, C), { status: "verified", hash: t, action: r, nonce: String(U(s.nonce)), target: i.to, blockNumber: a.blockNumber, liveAction: o.action };
}
const ns = (e) => (e && typeof e == "object" && (Object.values(e).forEach(ns), Object.freeze(e)), e), I = ns({ ...C, key: "nftree-original-redemption-send-v1-90b5292a", lockReceipt: "0xb3913d8880bc662a2f40434f84691c87374a7cd9d8f0401ee77b6eec6e91b6a9" }), Ft = ae(Rt(["uint64", "uint32", "bytes32", "uint32", "bytes32"], [1n, 30102, ee(I.adapter, { size: 32 }), 30378, I.peer])), b3 = D0([Rt(["uint8", "uint64", "uint32", "bytes32", "uint32", "bytes32"], [1, 1n, 30102, ee(I.adapter, { size: 32 }), 30378, I.peer]), Ft, es]), me = ns({ send: { label: "Send redemption request to Sui", to: I.adapter, data: De({ abi: dt(["function sendRedemption()"]), functionName: "sendRedemption" }), events: [
  { address: I.endpoint, topics: [ae(R0("PacketSent(bytes,bytes,address)"))], data: st([{ type: "bytes" }, { type: "bytes" }, { type: "address" }], [b3, ts, kt.sendLibrary]) },
  { address: I.adapter, topics: [ae(R0("RedemptionSent(bytes32,bytes32)")), Ft, I.request], data: "0x" }
] } }), x = (e, t) => {
  if (!e) throw Error(t);
}, t0 = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase(), Mn = (e) => /^0x[0-9a-f]{64}$/i.test(e ?? ""), ec = (e) => e === "send";
async function N0(e, t, n, a = [], s = [], r = "latest") {
  return r0(e, { method: "eth_call", params: [{ to: t, data: De({ abi: [{ type: "function", name: n, inputs: a, outputs: [], stateMutability: "view" }], functionName: n, args: s }) }, r] });
}
function p3(e) {
  return x(e.allowance === "0" && e.canPlay === "0", "Allowance or BNB access changed."), e.passState === "3" ? x(e.passBalance === "1" && t0(e.owner, I.from), "Locked original pass ownership changed.") : x(e.passState === "4" && e.passBalance === "0", "Original pass is not Locked or Retired."), x(["0", "1"].includes(e.sent) && e.outboundNonce === e.sent, "One-shot send flag and outbound nonce differ."), e.sent === "0" ? (x(e.passState === "3", "An unsent request cannot be retired."), "send") : "complete";
}
async function tc(e, { source: t = Ho } = {}) {
  await we(e, I);
  const n = U(await N0(e, I.adapter, "redemptionSent"));
  x(n === 0n || n === 1n, "Invalid redemption send flag."), n === 0n && await t();
  const a = await r0(e, { method: "eth_blockNumber" });
  U(a, "BNB block");
  const s = U(await N0(e, I.pass, "state", [], [], a));
  x(s === 3n || s === 4n, "Original pass must be Locked or Retired.");
  const r = U(await N0(e, I.adapter, "redemptionSent", [], [], a));
  x(r === 0n || r === 1n, "Invalid send flag."), x(n === 0n || r === 1n, "One-shot send state regressed.");
  for (const [w, W] of [[I.adapter, Lo()], [I.pass, zo()]])
    x(t0(await r0(e, { method: "eth_getCode", params: [w, a] }), W), "Original contract runtime or immutable bindings changed.");
  for (const [w, W] of Object.entries({ ...kt.code, [I.currency]: I.currencySha256 }))
    x(await $o(await r0(e, { method: "eth_getCode", params: [w, a] })) === W, "Protocol or currency runtime changed.");
  for (const w of kt.reads) {
    const W = await r0(e, { method: "eth_call", params: [{ to: w.to, data: w.data }, a] });
    x(t0(W, w.label === "Pass state" ? R0(s, { size: 32 }) : w.after), "LayerZero " + w.label + " differs from the verified Ready route.");
  }
  const i = [["initialBuyer", BigInt(I.from)], ["controller", BigInt(I.from)], ["route", BigInt(I.route)], ["currency", BigInt(I.currency)], ["treasury", BigInt(I.treasury)], ["PRICE", BigInt(I.price)], ["TOKEN_ID", 1n], ["backingNFT", BigInt(I.nft)], ["state", s], ["redemption", BigInt(I.request)], ["recipient", BigInt(I.recipient)]];
  for (const [w, W] of i) x(U(await N0(e, I.pass, w, [], [], a)) === W, "Original pass " + w + " changed.");
  for (const [w, W] of [["suiPeer", BigInt(I.peer)], ["route", BigInt(I.route)], ["backingNFT", BigInt(I.nft)], ["binder", BigInt(I.from)], ["redemptionGas", 30000000n], ["redemptionSent", r], ["redemptionGuid", r === 1n ? BigInt(Ft) : 0n], ["pass", BigInt(I.pass)]])
    x(U(await N0(e, I.adapter, w, [], [], a)) === W, "Original adapter " + w + " changed.");
  x(U(await N0(e, I.currency, "decimals", [], [], a)) === 18n, "BNB USDT decimals changed."), x(U(await N0(e, I.endpoint, "eid", [], [], a)) === 30102n, "Wrong BNB endpoint.");
  const o = async (w, W, L = [], L0 = []) => U(await N0(e, w, W, L, L0, a)), c = [{ name: "owner", type: "address" }], u = [I.from], f = String(await o(I.currency, "balanceOf", c, u)), l = String(await o(I.currency, "allowance", [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], [I.from, I.pass])), b = String(await o(I.pass, "balanceOf", c, u)), g = String(await o(I.pass, "canPlay", c, u)), m = await o(I.pass, "purchasesPaused");
  x(m === 0n, "The original purchase is paused.");
  let p;
  if (s === 3n) {
    const w = await N0(e, I.pass, "ownerOf", [{ name: "tokenId", type: "uint256" }], [1n], a);
    x(/^0x0{24}[0-9a-f]{40}$/i.test(w), "Invalid pass owner."), p = "0x" + w.slice(-40);
  }
  const y = String(U(await N0(e, I.endpoint, "outboundNonce", [{ name: "sender", type: "address" }, { name: "dstEid", type: "uint32" }, { name: "receiver", type: "bytes32" }], [I.adapter, 30378, I.peer], a)));
  s === 3n && x(t0(await N0(e, I.adapter, "redemptionPayload", [], [], a), st([{ type: "bytes" }], [es])), "On-chain redemption payload differs from the fixed original request."), x(t0(await N0(e, I.adapter, "redemptionOptions", [], [], a), st([{ type: "bytes" }], [ts])), "Destination gas or delivery options changed.");
  const E = { block: a, passState: String(s), tokenBalance: f, allowance: l, passBalance: b, canPlay: g, owner: p, sent: String(r), outboundNonce: y };
  return { ...E, action: p3(E), destinationStatus: "not_verified" };
}
async function Na(e) {
  const t = await Promise.all(["latest", "pending"].map(async (n) => U(await r0(e, { method: "eth_getTransactionCount", params: [I.from, n] }), "wallet nonce")));
  return x(t[0] === t[1], "A BNB wallet transaction is pending. Check its receipt first."), String(t[0]);
}
async function m3(e, t = "latest") {
  const n = await N0(e, I.adapter, "quoteRedemption", [], [], t), a = await r0(e, { method: "eth_call", params: [d3, t] });
  x(/^0x[0-9a-f]{128}$/i.test(n) && t0(n, a), "Adapter and fixed endpoint quotes differ.");
  const s = BigInt("0x" + n.slice(2, 66));
  return x(s > 0n && s <= BigInt(I.maxFeeWei) && BigInt("0x" + n.slice(66)) === 0n, "LayerZero native fee exceeds 0.006 BNB or requires LZ tokens."), String(s);
}
function g3(e, t) {
  x(/^0x[0-9a-f]{256}$/i.test(e) && t0("0x" + e.slice(2, 66), Ft) && BigInt("0x" + e.slice(66, 130)) === 1n && BigInt("0x" + e.slice(130, 194)) > 0n && BigInt("0x" + e.slice(130, 194)) <= BigInt(t) && BigInt("0x" + e.slice(194)) === 0n, "Send simulation returned a different GUID, nonce or fee.");
}
async function h3(e, { read: t = tc, lock: n = l3, now: a = Date.now } = {}) {
  await we(e, I);
  const s = await t(e), r = await n(e, I.lockReceipt, { read: async () => ({ action: "complete" }) });
  if (x(r.status === "verified" && r.action === "lock", "The actual original-backed lock receipt is not verified."), s.action === "complete") return { ...s, quotedAt: a() };
  const i = await m3(e, s.block), o = await Na(e), c = me.send, u = { from: I.from, to: c.to, data: c.data, value: R0(BigInt(i)) };
  g3(await r0(e, { method: "eth_call", params: [u, "latest"] }), i);
  const [f, l, b] = await Promise.all([r0(e, { method: "eth_estimateGas", params: [u, "latest"] }), r0(e, { method: "eth_gasPrice" }), r0(e, { method: "eth_getBalance", params: [I.from, "latest"] })].map(async (E) => U(await E)));
  x(f > 0n && f <= 1500000n && l > 0n, "Unexpected send gas estimate.");
  const g = (f * 120n + 99n) / 100n, m = g * l;
  x(m <= 10000000000000000n, "Buffered network gas exceeds 0.01 BNB.");
  const p = m + BigInt(i), y = b >= p;
  return await we(e, I), x(await Na(e) === o, "Wallet nonce changed. Refresh and review."), { ...s, action: y ? "send" : "fund", balanceWei: String(b), requiredBalanceWei: String(p), shortfallWei: String(y ? 0n : p - b), nonce: o, target: c.to, feeWei: i, gas: String(f), gasLimit: R0(g), estimatedFeeWei: String(f * l), gasLimitFeeWei: String(m), quotedAt: a() };
}
function yr(e) {
  return e && ec(e.action) && /^(0|[1-9][0-9]*)$/.test(e.nonce) && t0(e.target, me[e.action].to) && /^[1-9][0-9]*$/.test(e.valueWei) && BigInt(e.valueWei) <= BigInt(I.maxFeeWei) && (!e.hash || Mn(e.hash));
}
function Et(e) {
  const t = e.getItem(I.key);
  if (t === null) return { receipts: [] };
  const n = JSON.parse(t);
  return x(n && Array.isArray(n.receipts) && n.receipts.every((a) => yr(a) && a.status === "verified" && Mn(a.hash)) && (!n.pending || yr(n.pending)), "Stored redemption state needs review. Check wallet activity before another request."), n;
}
async function w3({ provider: e, storage: t, locks: n, reviewed: a, reviewedQuote: s, isCurrent: r, prepare: i = h3, onQuote: o = () => {
}, now: c = Date.now }) {
  return x(n?.request, "Use current Brave for redemption coordination."), n.request(I.key, { ifAvailable: !0 }, async (u) => {
    x(u, "Another tab is handling this redemption."), x(!Et(t).pending, "A wallet request is recorded. Recover its receipt first.");
    const f = s();
    x(a() && f && ec(f.action) && c() >= f.quotedAt && c() - f.quotedAt <= I.maxAge, "Simulate and review a fresh redemption step first.");
    const l = await i(e);
    if (x(r() && a(), "Wallet or review changed."), x(!Et(t).pending, "Another request was recorded."), ["action", "nonce", "target", "gas", "gasLimitFeeWei", "feeWei"].some((y) => l[y] !== f[y]) || c() - f.quotedAt > I.maxAge)
      throw o(l), Error("Redemption progress, nonce or gas changed. Review the refreshed step.");
    x(/^[1-9][0-9]*$/.test(l.feeWei) && BigInt(l.feeWei) <= BigInt(I.maxFeeWei) && t0(l.target, me.send.to), "Native fee or adapter target exceeds the fixed send plan."), x(c() >= l.quotedAt && c() - l.quotedAt <= I.maxAge, "Fresh checks expired."), await we(e, I), x(await Na(e) === l.nonce, "Wallet nonce changed before signing."), x(r() && a(), "Wallet or review changed.");
    const b = Et(t), g = { action: l.action, nonce: l.nonce, target: l.target, valueWei: l.feeWei, requestedAt: new Date(c()).toISOString() };
    sn(t, I.key, { ...b, pending: g });
    let m;
    try {
      m = await e.request({ method: "eth_sendTransaction", params: [{ from: I.from, to: g.target, chainId: I.chainId, nonce: R0(BigInt(g.nonce)), value: R0(BigInt(g.valueWei)), data: me[g.action].data, gas: l.gasLimit }] });
    } catch (y) {
      throw y?.code === 4001 && sn(t, I.key, b), y;
    }
    x(Mn(m), "No valid submission hash returned. Check wallet activity before retrying.");
    const p = { ...b, pending: { ...g, hash: m } };
    return sn(t, I.key, p), p;
  });
}
async function A3(e, t, { read: n = tc } = {}) {
  x(Mn(t), "Enter a BNB redemption-step transaction hash."), await we(e, I);
  const a = await r0(e, { method: "eth_getTransactionReceipt", params: [t] });
  if (!a) return { status: "pending", hash: t };
  x(t0(a.transactionHash, t) && U(a.status) === 1n && t0(a.from, I.from) && a.contractAddress === null, "Wrong or failed redemption receipt.");
  const s = await r0(e, { method: "eth_getTransactionByHash", params: [t] });
  x(s && t0(s.hash, t) && t0(s.from, I.from) && U(s.chainId) === 56n && U(s.value) > 0n && U(s.value) <= BigInt(I.maxFeeWei), "Wrong redemption transaction identity.");
  const r = Object.keys(me).find((u) => t0(s.to, me[u].to) && t0(s.input, me[u].data));
  x(r && t0(a.to, me[r].to), "Adapter target or fixed send calldata differs from review.");
  const i = me[r], o = (u, f) => t0(f.address, u.address) && t0(f.data, u.data) && f.removed !== !0 && f.topics?.length === u.topics.length && u.topics.every((l, b) => t0(l, f.topics[b]));
  x(Array.isArray(a.logs) && i.events.every((u) => a.logs.filter((f) => t0(f.address, u.address) && t0(f.topics?.[0], u.topics[0])).length === 1 && a.logs.filter((f) => o(u, f)).length === 1), "Exact LayerZero packet/options/library or adapter GUID/request event differs.");
  const c = await n(e);
  return x(c.action === "complete", "The one-shot send state does not reflect this receipt."), await we(e, I), { status: "verified", hash: t, action: r, nonce: String(U(s.nonce)), target: i.to, valueWei: String(U(s.value)), guid: Ft, destinationStatus: "not_verified", blockNumber: a.blockNumber, liveAction: c.action };
}
async function v3({ provider: e, hash: t, storage: n, locks: a, isCurrent: s = () => !0, verify: r = A3 }) {
  return x(a?.request, "Use current Brave for receipt coordination."), a.request(I.key, { ifAvailable: !0 }, async (i) => {
    x(i, "Another tab is checking this redemption.");
    const o = Et(n);
    o.pending?.hash && x(t0(o.pending.hash, t), "A different transaction is recorded.");
    const c = await r(e, t);
    return x(s(), "Wallet changed during receipt verification."), x(JSON.stringify(Et(n)) === JSON.stringify(o), "Stored redemption state changed during verification."), c.status === "pending" || (o.pending && x(c.action === o.pending.action && c.nonce === o.pending.nonce && t0(c.target, o.pending.target) && c.valueWei === o.pending.valueWei, "Receipt does not match the recorded request."), sn(n, I.key, { receipts: [...o.receipts.filter((u) => !t0(u.hash, t)), c] })), c;
  });
}
export {
  I as C,
  Ft as GUID,
  ts as OPTIONS,
  b3 as PACKET,
  es as PAYLOAD,
  me as STEPS,
  y3 as createReadProvider,
  Et as loadState,
  h3 as preflight,
  m3 as quoteFee,
  tc as readSend,
  v3 as recoverReceipt,
  w3 as requestSend,
  p3 as resolveAction,
  A3 as verifyReceipt,
  g3 as verifySimulation
};
