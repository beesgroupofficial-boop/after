import React, { useState, useEffect, useMemo } from "react";

// ───────── Firebase（index.html のCDN compat で初期化済み） ─────────
const db = window._db;
const COL = { records: "after_records", config: "app_config" };
const CONFIG_DOC = "main";
const ADMIN_PASS = "1111";

async function fsSet(col, id, data) { await db.collection(col).doc(String(id)).set(data); }
async function fsMerge(col, id, data) { await db.collection(col).doc(String(id)).set(data, { merge: true }); }
async function fsDel(col, id) { await db.collection(col).doc(String(id)).delete(); }

// ───────── ヘルパー ─────────
// 営業日：朝9時までは前日扱い（MASHのPOSと同じ日付になる）
function businessDate() {
  const d = new Date(Date.now() - 9 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function yen(n) { return "¥" + Math.round(n || 0).toLocaleString("ja-JP"); }
function periodKeyOf(date) { return parseInt(date.slice(8, 10), 10) <= 15 ? "p1" : "p2"; }
function rateOf(backRates, cast, date) { return backRates?.[cast]?.[periodKeyOf(date)] ?? 0.1; }
// バックは税抜き（総額÷1.1 切り捨て）× バック率
function calcBack(amount, rate) {
  const taxExcluded = Math.floor((Number(amount) || 0) / 1.1);
  return { taxExcluded, backAmount: Math.round(taxExcluded * rate) };
}
function periodRange(month, period) {
  const y = parseInt(month.slice(0, 4), 10);
  const m = parseInt(month.slice(5, 7), 10);
  if (period === "p1") return [`${month}-01`, `${month}-15`];
  const last = new Date(y, m, 0).getDate();
  return [`${month}-16`, `${month}-${String(last).padStart(2, "0")}`];
}
function shortDate(d) {
  const w = ["日", "月", "火", "水", "木", "金", "土"][new Date(d + "T12:00:00").getDay()];
  return `${parseInt(d.slice(5, 7), 10)}/${parseInt(d.slice(8, 10), 10)}(${w})`;
}

// ───────── デザイン ─────────
const C = {
  bg: "#F6F4F9", surface: "#FFFFFF", border: "#E4DFEC", text: "#1E1B24",
  mid: "#6B6478", light: "#A39DAE", plum: "#5B21B6", violet: "#7C3AED",
  lilac: "#F1ECFB", danger: "#DC2626",
};
const FONT = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" };
const inp = {
  background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10,
  padding: "11px 14px", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box",
  fontFamily: FONT,
};
const label = { fontSize: 13, fontWeight: 700, color: C.mid, margin: "16px 0 8px" };
function pill(active) {
  return {
    padding: "9px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${active ? C.violet : C.border}`,
    background: active ? C.violet : C.surface, color: active ? "#fff" : C.mid, fontFamily: FONT,
  };
}
const primaryBtn = {
  width: "100%", padding: "15px 0", borderRadius: 12, border: "none", background: C.plum,
  color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
};

// ───────── トースト ─────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", left: "50%", bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
      transform: "translateX(-50%)", zIndex: 50, padding: "10px 18px", borderRadius: 999,
      background: toast.ok ? C.text : C.danger, color: "#fff", fontSize: 14, fontWeight: 600,
      whiteSpace: "nowrap", boxShadow: "0 6px 20px rgba(30,27,36,.25)",
    }}>{toast.msg}</div>
  );
}

// ───────── ログイン ─────────
function Login({ onLogin }) {
  const [mode, setMode] = useState(null);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: C.plum, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ color: "#fff", fontSize: 30, fontWeight: 700, letterSpacing: "0.04em" }}>アフターバック</div>
        <div style={{ color: "#D9CCF5", fontSize: 14, marginTop: 6, marginBottom: 32 }}>アフターの売上とキャストバックを記録します</div>
        {mode !== "admin" ? (
          <>
            <button style={{ ...primaryBtn, background: "#fff", color: C.plum, marginBottom: 12 }} onClick={() => onLogin("staff")}>スタッフで入る</button>
            <button style={{ ...primaryBtn, background: "transparent", border: "1px solid #B9A3EA" }} onClick={() => setMode("admin")}>管理者で入る</button>
          </>
        ) : (
          <>
            <input type="password" inputMode="numeric" autoFocus placeholder="パスワード" value={pass}
              onChange={e => { setPass(e.target.value); setErr(""); }}
              onKeyDown={e => { if (e.key === "Enter") (pass === ADMIN_PASS ? onLogin("admin") : setErr("パスワードが違います")); }}
              style={{ ...inp, marginBottom: 8 }} />
            {err && <div style={{ color: "#FECACA", fontSize: 13, marginBottom: 8 }}>{err}</div>}
            <button style={{ ...primaryBtn, background: "#fff", color: C.plum, marginBottom: 12 }}
              onClick={() => (pass === ADMIN_PASS ? onLogin("admin") : setErr("パスワードが違います"))}>ログイン</button>
            <button style={{ ...primaryBtn, background: "transparent", border: "1px solid #B9A3EA" }} onClick={() => { setMode(null); setPass(""); setErr(""); }}>戻る</button>
          </>
        )}
      </div>
    </div>
  );
}

// ───────── 入力タブ ─────────
function InputTab({ config, showToast }) {
  const { castList, backRates, stores } = config;
  const [date, setDate] = useState(businessDate());
  const [store, setStore] = useState(stores[0] || "");
  const [cast, setCast] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!stores.includes(store)) setStore(stores[0] || ""); }, [stores]);

  const rate = cast ? rateOf(backRates, cast, date) : 0;
  const { taxExcluded, backAmount } = calcBack(amount, rate);
  const canSave = cast && Number(amount) > 0 && date && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const id = Date.now() + "_a";
      await fsSet(COL.records, id, {
        id, date, store, cast, customerName: customerName.trim(), memo: memo.trim(),
        amount: Number(amount), taxExcluded, backRate: rate, backAmount,
        createdAt: new Date().toISOString(),
      });
      showToast(`登録しました ${cast} バック${yen(backAmount)}`);
      setCustomerName(""); setAmount(""); setMemo(""); setCast("");
    } catch (e) {
      showToast("登録できませんでした。通信状態を確認してください", false);
    }
    setSaving(false);
  }

  if (castList.length === 0) {
    return (
      <div style={{ ...card, textAlign: "center", color: C.mid, fontSize: 14, lineHeight: 1.8 }}>
        キャストが登録されていません。<br />管理者でログインし、設定タブからキャストを追加してください。
      </div>
    );
  }

  return (
    <div>
      <div style={label}>日付</div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />

      {stores.length > 1 && (
        <>
          <div style={label}>店舗</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {stores.map(s => <button key={s} style={pill(store === s)} onClick={() => setStore(s)}>{s}</button>)}
          </div>
        </>
      )}

      <div style={label}>キャスト</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {castList.map(c => <button key={c} style={pill(cast === c)} onClick={() => setCast(c)}>{c}</button>)}
      </div>

      <div style={label}>金額（税込）</div>
      <input type="number" inputMode="numeric" placeholder="例：33000" value={amount}
        onChange={e => setAmount(e.target.value)} style={{ ...inp, fontSize: 22, fontWeight: 700 }} />

      <div style={label}>お客様名（任意）</div>
      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} style={inp} />

      <div style={label}>メモ（任意）</div>
      <input type="text" placeholder="例：〇〇でアフター" value={memo} onChange={e => setMemo(e.target.value)} style={inp} />

      <div style={{ ...card, background: C.lilac, borderColor: "#DCCFF6", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.mid }}>
          <span>税抜</span><span>{yen(taxExcluded)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.mid, marginTop: 4 }}>
          <span>バック率{cast ? `（${periodKeyOf(date) === "p1" ? "1〜15日" : "16〜末日"}）` : ""}</span>
          <span>{cast ? `${Math.round(rate * 100)}%` : "キャストを選択"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.plum }}>バック</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: C.plum }}>{yen(backAmount)}</span>
        </div>
      </div>

      <button onClick={save} disabled={!canSave}
        style={{ ...primaryBtn, marginTop: 16, opacity: canSave ? 1 : 0.4, cursor: canSave ? "pointer" : "default" }}>
        {saving ? "登録中…" : "アフターを登録"}
      </button>
    </div>
  );
}

// ───────── 編集モーダル（管理者） ─────────
function EditModal({ record, config, onClose, showToast }) {
  const [date, setDate] = useState(record.date);
  const [store, setStore] = useState(record.store || "");
  const [cast, setCast] = useState(record.cast);
  const [customerName, setCustomerName] = useState(record.customerName || "");
  const [amount, setAmount] = useState(String(record.amount));
  const [memo, setMemo] = useState(record.memo || "");
  const [rate, setRate] = useState(record.backRate ?? 0.1);
  const { taxExcluded, backAmount } = calcBack(amount, rate);
  const castOptions = config.castList.includes(cast) ? config.castList : [cast, ...config.castList];
  const storeOptions = !store || config.stores.includes(store) ? config.stores : [store, ...config.stores];

  async function save() {
    if (!cast || !(Number(amount) > 0)) return;
    await fsSet(COL.records, record.id, {
      ...record, date, store, cast, customerName: customerName.trim(), memo: memo.trim(),
      amount: Number(amount), taxExcluded, backRate: rate, backAmount,
      updatedAt: new Date().toISOString(),
    });
    showToast("変更を保存しました");
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,36,.45)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
        borderRadius: "18px 18px 0 0", padding: "18px 16px calc(24px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>明細を編集</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.mid, cursor: "pointer" }}>✕</button>
        </div>
        <div style={label}>日付</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
        {storeOptions.length > 1 && (<>
          <div style={label}>店舗</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {storeOptions.map(s => <button key={s} style={pill(store === s)} onClick={() => setStore(s)}>{s}</button>)}
          </div>
        </>)}
        <div style={label}>キャスト</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {castOptions.map(c => <button key={c} style={pill(cast === c)} onClick={() => setCast(c)}>{c}</button>)}
        </div>
        <div style={label}>金額（税込）</div>
        <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} style={inp} />
        <div style={label}>バック率</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0.1, 0.15].map(r => <button key={r} style={{ ...pill(rate === r), flex: 1 }} onClick={() => setRate(r)}>{Math.round(r * 100)}%</button>)}
        </div>
        <div style={label}>お客様名</div>
        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} style={inp} />
        <div style={label}>メモ</div>
        <input type="text" value={memo} onChange={e => setMemo(e.target.value)} style={inp} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "18px 2px 12px" }}>
          <span style={{ fontSize: 14, color: C.mid }}>バック</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: C.plum }}>{yen(backAmount)}</span>
        </div>
        <button onClick={save} style={primaryBtn}>変更を保存</button>
      </div>
    </div>
  );
}

// ───────── 集計タブ ─────────
function SummaryTab({ records, isAdmin, onEdit, showToast }) {
  const now = businessDate();
  const [month, setMonth] = useState(now.slice(0, 7));
  const [period, setPeriod] = useState(periodKeyOf(now));
  const [openCast, setOpenCast] = useState(null);

  const periodData = useMemo(() => {
    const [s, e] = periodRange(month, period);
    return records.filter(r => r.date >= s && r.date <= e);
  }, [records, month, period]);

  const castSummary = useMemo(() => {
    const m = {};
    periodData.forEach(r => {
      if (!m[r.cast]) m[r.cast] = { cast: r.cast, count: 0, amount: 0, backAmount: 0, records: [] };
      m[r.cast].count++;
      m[r.cast].amount += r.amount || 0;
      m[r.cast].backAmount += r.backAmount || 0;
      m[r.cast].records.push(r);
    });
    Object.values(m).forEach(x => x.records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
    return Object.values(m).sort((a, b) => b.backAmount - a.backAmount);
  }, [periodData]);

  const totalBack = periodData.reduce((a, r) => a + (r.backAmount || 0), 0);
  const totalAmount = periodData.reduce((a, r) => a + (r.amount || 0), 0);
  const periodLabel = period === "p1" ? "1〜15日" : "16〜末日";

  async function delCast(cast, recs) {
    if (!window.confirm(`${cast}の${month.replace("-", "年")}月 ${periodLabel}分を全部削除しますか？`)) return;
    for (const r of recs) await fsDel(COL.records, r.id);
    showToast(`${cast}の明細を削除しました`);
  }
  async function delOne(r) {
    if (!window.confirm(`${shortDate(r.date)} ${r.cast} ${yen(r.amount)} を削除しますか？`)) return;
    await fsDel(COL.records, r.id);
    showToast("削除しました");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 15, padding: "9px 10px" }} />
        {[["p1", "1〜15日"], ["p2", "16〜末日"]].map(([v, l]) => (
          <button key={v} style={{ ...pill(period === v), flex: 1 }} onClick={() => setPeriod(v)}>{l}</button>
        ))}
      </div>

      <div style={{ background: C.plum, color: "#fff", borderRadius: 16, padding: "18px 18px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#D9CCF5" }}>{parseInt(month.slice(5, 7), 10)}月 {periodLabel}のバック合計</div>
        <div style={{ fontSize: 34, fontWeight: 700, marginTop: 2 }}>{yen(totalBack)}</div>
        <div style={{ fontSize: 13, color: "#D9CCF5", marginTop: 2 }}>{periodData.length}件　売上 {yen(totalAmount)}</div>
      </div>

      {castSummary.length === 0 && (
        <div style={{ textAlign: "center", color: C.light, padding: "36px 0", fontSize: 14 }}>この期間のアフターはまだありません</div>
      )}

      {castSummary.map(({ cast, count, amount, backAmount, records: recs }) => {
        const open = openCast === cast;
        return (
          <div key={cast} style={{ ...card, marginBottom: 10, padding: 0, overflow: "hidden" }}>
            <button onClick={() => setOpenCast(open ? null : cast)} style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "none", border: "none", padding: "14px 16px", cursor: "pointer", fontFamily: FONT, textAlign: "left",
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{cast}</div>
                <div style={{ fontSize: 12, color: C.light, marginTop: 2 }}>{count}件　売上 {yen(amount)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: C.plum }}>{yen(backAmount)}</span>
                <span style={{ color: C.light, fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
              </div>
            </button>
            {open && (
              <div style={{ padding: "0 16px 12px" }}>
                {recs.map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: C.text }}>
                        {shortDate(r.date)}　{yen(r.amount)}
                        <span style={{ color: C.light }}>（{Math.round((r.backRate ?? 0) * 100)}%）</span>
                      </div>
                      <div style={{ color: C.light, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[r.store, r.customerName && `${r.customerName}様`, r.memo].filter(Boolean).join("／")}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontWeight: 700 }}>{yen(r.backAmount)}</span>
                      {isAdmin && (<>
                        <button onClick={() => onEdit(r)} style={{ background: C.lilac, border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: C.plum, cursor: "pointer" }}>編集</button>
                        <button onClick={() => delOne(r)} style={{ background: "none", border: "none", color: C.light, cursor: "pointer", fontSize: 15 }}>✕</button>
                      </>)}
                    </div>
                  </div>
                ))}
                {isAdmin && (
                  <button onClick={() => delCast(cast, recs)} style={{ marginTop: 8, background: "none", border: `1px solid ${C.danger}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.danger, cursor: "pointer" }}>
                    {cast}のこの期間を全部削除
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────── 設定タブ（管理者） ─────────
function SettingsTab({ config, showToast }) {
  const { castList, backRates, stores } = config;
  const [castName, setCastName] = useState("");
  const [storeName, setStoreName] = useState("");

  function addCast() {
    const n = castName.trim();
    if (!n) return;
    if (castList.includes(n)) return showToast("すでに登録されています", false);
    fsMerge(COL.config, CONFIG_DOC, { castList: [...castList, n] });
    setCastName("");
  }
  function removeCast(c) {
    if (!window.confirm(`${c}をキャスト一覧から外しますか？（過去の明細は残ります）`)) return;
    fsMerge(COL.config, CONFIG_DOC, { castList: castList.filter(x => x !== c) });
  }
  function setRate(cast, pk, r) {
    const next = { ...backRates, [cast]: { ...(backRates[cast] || {}), [pk]: r } };
    fsMerge(COL.config, CONFIG_DOC, { backRates: next });
  }
  function addStore() {
    const n = storeName.trim();
    if (!n) return;
    if (stores.includes(n)) return showToast("すでに登録されています", false);
    fsMerge(COL.config, CONFIG_DOC, { stores: [...stores, n] });
    setStoreName("");
  }
  function removeStore(s) {
    if (stores.length <= 1) return showToast("店舗は1つ以上必要です", false);
    fsMerge(COL.config, CONFIG_DOC, { stores: stores.filter(x => x !== s) });
  }

  const chip = { display: "flex", alignItems: "center", gap: 4, background: C.lilac, border: "1px solid #DCCFF6", borderRadius: 8, padding: "5px 10px" };

  return (
    <div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>キャスト</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
          {castList.map(c => (
            <div key={c} style={chip}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.plum }}>{c}</span>
              <button onClick={() => removeCast(c)} style={{ background: "none", border: "none", color: C.light, cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
          {castList.length === 0 && <div style={{ fontSize: 13, color: C.light }}>まだ登録がありません</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="キャスト名" value={castName} onChange={e => setCastName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCast()} style={{ ...inp, flex: 1, minWidth: 0 }} />
          <button onClick={addCast} style={{ ...primaryBtn, width: "auto", padding: "0 18px", fontSize: 15 }}>追加</button>
        </div>
      </div>

      {castList.length > 0 && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>バック率</div>
          <div style={{ fontSize: 12, color: C.mid, margin: "4px 0 12px" }}>税抜金額に対する率。期ごとに設定できます。</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "8px 10px", alignItems: "center" }}>
            <div />
            <div style={{ fontSize: 12, color: C.mid, textAlign: "center", fontWeight: 600 }}>1〜15日</div>
            <div style={{ fontSize: 12, color: C.mid, textAlign: "center", fontWeight: 600 }}>16〜末日</div>
            {castList.map(cast => (
              <React.Fragment key={cast}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.plum, whiteSpace: "nowrap" }}>{cast}</div>
                {["p1", "p2"].map(pk => {
                  const cur = backRates?.[cast]?.[pk] ?? 0.1;
                  return (
                    <div key={pk} style={{ display: "flex", gap: 4 }}>
                      {[0.1, 0.15].map(r => (
                        <button key={r} onClick={() => setRate(cast, pk, r)} style={{ ...pill(cur === r), flex: 1, padding: "7px 0", fontSize: 13 }}>
                          {Math.round(r * 100)}%
                        </button>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>店舗</div>
        <div style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>2店舗以上あると入力画面で選べるようになります。</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
          {stores.map(s => (
            <div key={s} style={chip}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.plum }}>{s}</span>
              <button onClick={() => removeStore(s)} style={{ background: "none", border: "none", color: C.light, cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="店舗名" value={storeName} onChange={e => setStoreName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStore()} style={{ ...inp, flex: 1, minWidth: 0 }} />
          <button onClick={addStore} style={{ ...primaryBtn, width: "auto", padding: "0 18px", fontSize: 15 }}>追加</button>
        </div>
      </div>
    </div>
  );
}

// ───────── App ─────────
const DEFAULT_CONFIG = { castList: [], backRates: {}, stores: ["BAR MASH"] };

export default function App() {
  const [role, setRole] = useState(() => { try { return localStorage.getItem("after_role"); } catch { return null; } });
  const [tab, setTab] = useState("input");
  const [records, setRecords] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    clearTimeout(window.__afterToast);
    window.__afterToast = setTimeout(() => setToast(null), 2200);
  }
  function login(r) { try { localStorage.setItem("after_role", r); } catch {} setRole(r); setTab("input"); }
  function logout() { try { localStorage.removeItem("after_role"); } catch {} setRole(null); }

  useEffect(() => {
    if (!db) return;
    const u1 = db.collection(COL.records).orderBy("createdAt", "desc").onSnapshot(
      snap => setRecords(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      () => showToast("データを読み込めません。Firebaseの設定を確認してください", false)
    );
    const u2 = db.collection(COL.config).doc(CONFIG_DOC).onSnapshot(snap => {
      const d = snap.data() || {};
      setConfig({
        castList: Array.isArray(d.castList) ? d.castList : [],
        backRates: d.backRates || {},
        stores: Array.isArray(d.stores) && d.stores.length ? d.stores : DEFAULT_CONFIG.stores,
      });
      setLoaded(true);
    });
    return () => { u1(); u2(); };
  }, []);

  if (!db) {
    return <div style={{ padding: 24, fontFamily: FONT }}>Firebaseが初期化されていません。index.html の firebaseConfig を確認してください。</div>;
  }
  if (!role) return <Login onLogin={login} />;

  const isAdmin = role === "admin";
  const tabs = isAdmin
    ? [["input", "入力"], ["summary", "集計"], ["settings", "設定"]]
    : [["input", "入力"], ["summary", "集計"]];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT, color: C.text, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "14px 16px calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.plum }}>アフターバック</div>
          <button onClick={logout} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: C.mid, cursor: "pointer", fontFamily: FONT }}>
            {isAdmin ? "管理者" : "スタッフ"}・ログアウト
          </button>
        </div>

        {!loaded ? (
          <div style={{ textAlign: "center", color: C.light, padding: "60px 0" }}>読み込み中…</div>
        ) : (
          <>
            {tab === "input" && <InputTab config={config} showToast={showToast} />}
            {tab === "summary" && <SummaryTab records={records} isAdmin={isAdmin} onEdit={setEditing} showToast={showToast} />}
            {tab === "settings" && isAdmin && <SettingsTab config={config} showToast={showToast} />}
          </>
        )}
      </div>

      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, background: C.surface, borderTop: `1px solid ${C.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 30,
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex" }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "14px 0", background: "none", border: "none", cursor: "pointer", fontFamily: FONT,
              fontSize: 15, fontWeight: tab === k ? 700 : 500, color: tab === k ? C.plum : C.light,
              borderTop: `3px solid ${tab === k ? C.plum : "transparent"}`,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {editing && <EditModal record={editing} config={config} onClose={() => setEditing(null)} showToast={showToast} />}
      <Toast toast={toast} />
    </div>
  );
}
