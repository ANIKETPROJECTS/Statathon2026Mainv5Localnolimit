# Keystream Generation Analysis

## Starting point confirmed

```
combined seed = 0x8E8D5C0D  →  first byte = 29  ✓
```

All values below were produced by running the exact source code — not inferred from the UI text.

---

## 1. File and function responsible

**File:** `artifacts/csv-profiler/src/lib/anonymize.ts`

Two functions are involved:

| Function | Role |
|---|---|
| `makeCellKsBytes(size, keyHex, ivSeed)` | **Entry point.** XORs the first 8 hex chars of the round key with the column IV to get the combined seed, then calls `makeKeystream`. |
| `makeKeystream(seed)` | **PRNG.** Initialises two 32-bit state variables from the seed and returns a closure; each call to the closure advances the state and returns a float in [0, 1). |

---

## 2. How the combined seed is formed (`makeCellKsBytes`)

```typescript
// line 58
const combined = (parseInt(keyHex.slice(0, 8), 16) ^ ivSeed) >>> 0;
const ksRng = makeKeystream(combined);
```

```
keyHex first 8 chars  = 0xC869073B
ivSeed (column IV)    = 0x46E45B36
combined              = 0xC869073B ^ 0x46E45B36 = 0x8E8D5C0D
```

This `combined` value is passed as `seed` to `makeKeystream`.

---

## 3. PRNG initialisation from `makeKeystream(0x8E8D5C0D)`

```typescript
let a = ((seed ^ 0x9e3779b9) >>> 0) || 1;
let b = ((seed ^ 0x6c62272e) >>> 0) || 2;
```

| | Calculation | Result (hex) | Result (decimal) |
|---|---|---|---|
| `a` | `0x8E8D5C0D ^ 0x9E3779B9` | `0x10BA25B4` | 280,634,804 |
| `b` | `0x8E8D5C0D ^ 0x6C62272E` | `0xE2EF7B23` | 3,807,345,443 |

Neither result is zero, so the `|| 1` / `|| 2` fallbacks do not fire.

---

## 4 & 5. First PRNG call — every operation with intermediate hex/decimal values

The returned closure runs these six mutations on `a` and `b`, then combines them.

### a-side (three steps)

#### Step A1 — `a ^= a << 13; a = a >>> 0;`

```
a                    = 0x10BA25B4  (280,634,804)
a << 13              = 0x44B68000  (1,152,811,008)
a ^= (a << 13)       = 0x10BA25B4 ^ 0x44B68000
                     = 0x540CA5B4  (1,410,114,996)
a >>> 0              = 0x540CA5B4  (unchanged, high bit is 0)
```

#### Step A2 — `a ^= a >> 17;`  *(no `>>> 0` after this step)*

```
a                    = 0x540CA5B4  (1,410,114,996)
a >> 17              = 0x00002A06  (10,758)
a ^= (a >> 17)       = 0x540CA5B4 ^ 0x00002A06
                     = 0x540C8FB2  (1,410,109,362)
```

High bit is still 0, so the missing `>>> 0` has no effect here.

#### Step A3 — `a ^= a << 5; a = a >>> 0;`

```
a                    = 0x540C8FB2  (1,410,109,362)
a << 5               = 0x8191F640  (2,173,826,624)   ← high bit SET (negative as signed)
a ^= (a << 5)        = 0x540C8FB2 ^ 0x8191F640
                     = 0xD59D79F2  (signed: −711,099,918)
a >>> 0              = 0xD59D79F2  (3,583,867,378)    ← unsigned 32-bit
```

**a after all three steps = `0xD59D79F2` = 3,583,867,378**

---

### b-side (three steps)

#### Step B1 — `b ^= b >> 7; b = b >>> 0;`

```
b                    = 0xE2EF7B23  (signed: −487,621,853; unsigned: 3,807,345,443)
b >> 7               = 0xFFC5DEF6  (arithmetic shift; high bit was 1, so 7 sign bits prepended)
                                   = 4,291,157,750 unsigned
b ^= (b >> 7)        = 0xE2EF7B23 ^ 0xFFC5DEF6
                     = 0x1D2AA5D5  (489,334,229)
b >>> 0              = 0x1D2AA5D5  (unchanged)
```

#### Step B2 — `b ^= b << 9; b = b >>> 0;`

```
b                    = 0x1D2AA5D5  (489,334,229)
b << 9               = 0x554BAA00  (1,431,022,080)
b ^= (b << 9)        = 0x1D2AA5D5 ^ 0x554BAA00
                     = 0x48610FD5  (1,214,320,597)
b >>> 0              = 0x48610FD5  (unchanged)
```

#### Step B3 — `b ^= b >> 8; b = b >>> 0;`

```
b                    = 0x48610FD5  (1,214,320,597)
b >> 8               = 0x0048610F  (4,743,439)
b ^= (b >> 8)        = 0x48610FD5 ^ 0x0048610F
                     = 0x48296EDA  (1,210,674,906)
b >>> 0              = 0x48296EDA  (unchanged)
```

**b after all three steps = `0x48296EDA` = 1,210,674,906**

---

### Combine

```typescript
return (((a + b) >>> 0) / 0x100000000);
```

```
a            = 0xD59D79F2  = 3,583,867,378
b            = 0x48296EDA  = 1,210,674,906
a + b        = 4,794,542,284  (overflows 32 bits)
(a+b) >>> 0  = 0x1DC6E8CC  =   499,574,988   (lower 32 bits only)
÷ 0x100000000 (= 4,294,967,296)
float        = 0.11631636600941…
```

---

## 6 & 7. Converting the float to byte 29

```typescript
ksBytes[i] = Math.floor(ksRng() * 256);
```

```
0.11631636600941… × 256 = 29.7769…
Math.floor(29.7769…)    = 29
```

**Method: multiply by 256 then floor.** This keeps the lower 8 bits of the 32-bit PRNG output (effectively `(a+b) >>> 0` scaled to [0, 255]).  
It does **not** use modulo 256, upper 8 bits, or any rounding — strictly `floor(float × 256)`.

---

## 8. State change → second byte = 105

After the first call the closure holds:

```
a = 0xD59D79F2
b = 0x48296EDA
```

The same six mutations run again on these values:

**a-side:**

```
a start              = 0xD59D79F2
a ^= a<<13; >>>0     = 0x7AA339F2
a ^= a>>17           = 0x7AA304A3
a ^= a<<5;  >>>0     = 0x2EC390C3
```

**b-side:**

```
b start              = 0x48296EDA
b ^= b>>7;  >>>0     = 0x48B93C07
b ^= b<<9;  >>>0     = 0x3AC13207
b ^= b>>8;  >>>0     = 0x3AFBF335
```

**Combine:**

```
a + b        = 0x2EC390C3 + 0x3AFBF335 = 0x69BF83F8  (1,774,158,840, no overflow)
÷ 4,294,967,296 = 0.41307854466140…
× 256        = 105.7481…
Math.floor   = 105  ✓
```

---

## 9. Does the implementation match the UI description?

**Almost — with one important discrepancy.**

The UI (in `GuideSection.tsx`) describes the algorithm as **xorshift128+**. The actual implementation is a *variant* of xorshift128+, but with a non-standard b-side schedule:

| | Standard xorshift128+ | This implementation |
|---|---|---|
| **a-side** | `a ^= a<<23; a ^= a>>17; a ^= b>>26` | `a ^= a<<13; a ^= a>>17; a ^= a<<5` |
| **b-side** | `b ^= b<<14` (some variants differ) | `b ^= b>>7; b ^= b<<9; b ^= b>>8` |
| **output** | `(a+b) & 0xFFFFFFFF` | `((a+b) >>> 0) / 0x100000000` |
| **output type** | integer | float [0,1) |

The UI correctly describes the output pipeline (`float × 256 → floor → byte`), but the shift constants and the b-side sequence in the actual code do not match any published standard xorshift128+ specification. The algorithm is custom.

The UI statement *"five keystream bytes per character"* accurately matches the code:  
each character consumes exactly **5 calls** to `ksRng()` (one per micro-operation in `encryptFPECell`).
