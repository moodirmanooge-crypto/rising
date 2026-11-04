// src/utils/paperPrint.js
//
// Warqadda exam-ka (PDF) si toos ah u daabac.
//  1) PDF-ka waa la soo dejiyaa (blob) → iframe qarsoon → print() — daaqadda
//     print-ka ayaa isla markiiba furmaysa.
//  2) Haddii browser-ku diido (Firebase Storage CORS lama dejin), PDF-ka waxaa
//     lagu furayaa tab cusub oo print-ku si toos ah ayuu u bilaabmayaa
//     (Ctrl + P haddii uusan bilaaban).

export async function printPdf(url, title = "Exam paper") {
  if (!url) return;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.title = title;
    frame.src = blobUrl;
    frame.onload = () => {
      setTimeout(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch {
          window.open(blobUrl, "_blank");
        }
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      }, 400);
    };
    document.body.appendChild(frame);
    return "printed";
  } catch {
    const w = window.open(url, "_blank", "noopener");
    if (!w) window.alert("Browser-ku wuu xannibay tab-ka cusub. U ogolow pop-ups, kadib mar kale riix Print.");
    return "opened";
  }
}

// Fayl (Word) soo deji magaciisa saxda ah
export async function downloadFile(url, name = "exam.docx") {
  if (!url) return;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}