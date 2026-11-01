# Isbeddelada — Rising Star School

## 1. Cashier — lacagta
- Lacag kasta waxaa lagu keydiyaa **Firestore transaction**: laba cashier ama laba click isku mar ma qaadi karaan isla lacagta.
- Ardayga bishaas lacagtiisa oo dhan bixiyay **lacag kale lagama qaadi karo** — badhanka "Receive" waxaa beddela "🔒 Paid".
- Lacag ka badan inta ka hartay lama qaadi karo (hubin server-ka gudihiisa ah, ma aha kaliya foomka).
- **Cashier-ku ma beddeli karo lacagta, bisha, mana ka noqon karo rasiid** — kaliya habka lacag-bixinta (method) iyo note-ka.
- **Admin oo keliya** ayaa beddeli kara lacagta / bisha ama ka noqon kara (amount = 0 → UNPAID). Markaas ka dib ayuu cashier-ku mar kale qaadi karaa → "ilaa maamulku amro".
- Diiwaanka dhaqdhaqaaqa: "Payment reversed" waa la daray.
- Faylal: `utils/payments.js`, `components/PaymentEditModal.jsx`, `components/FeeRow.jsx`, `pages/CashierPortal.jsx`.

## 2. Ardayga — fasallo badan, hal ID + hal password
- Foomka ardayga: **"Ku dar fasal kale"** — arday wuxuu geli karaa laba fasal ama ka badan (tusaale Class 8 + Class A English Elementary) isagoo haysta **isla Student ID iyo password**.
- Fasal kasta **maadooyinkiisa gooni** ayuu leeyahay (`enrollments`). Tusaale: ardayga Class 8 Xisaab keliya ka qaata, macallinka Class 8 English **ma arko**.
- Isla fasal laba jeer laguma dari karo.
- Bogga Classes: "Move/Promote" wuxuu beddelaa **fasalka laga wareejinayo oo keliya** — fasalka kale ee ardaygu ku jiro wuu sii jiraa.
- Student List: ardaygu wuxuu ka muuqdaa fasal kasta oo uu ku jiro. Student Portal: fasallada oo dhan ayaa muuqda (live).
- Ardayda hore si toos ah ayay u shaqeeyaan (wax migration ah looma baahna).

## 3. Macallinka — diiwaangelin iyo xaadirin
- Foomka macallinka: maadada waxaa laga doortaa **maadooyinka fasalkaas oo keliya** (Class A English → English). Maado aan fasalka ku jirin lama keydin karo.
- Username-ka macallinka: transaction — laba macallin isku username ma yeelan karaan.
- **Xaadirinta waa fasal-fasal**: fasal kasta waxaa la xaadirin karaa **xiisaddiisa oo keliya** (hore waqtiga macallinka oo dhan ayaa la isticmaalayay — macallinku Class 8 ayuu xaadirin karay xilliga xiisadda English).
- Kaarka fasal kasta wuxuu muujinayaa waqtigiisa maanta iyo xaaladdiisa (Open now / Later today / Closed).
- Keydinta xaadirinta: transaction — fasal kasta hal mar maalintii, xitaa haddii laba tab/qalab laga furo.

## 4. UI
- Foomka ardayga: calaamadaha (labels) bartamaha u dhacayay waa la saxay; fasal kasta kaar gooni ah.
- Admin "Latest submissions": key-yo isku mid ah (macallin fasallo badan leh) waa la saxay.

## Xusuusin
Ledger-ka lacagta wuxuu ku jiraa `rssCounters` (`fee_{studentId}_{bisha}`) — collection horey u jirtay, Firestore Rules cusub looma baahna.
