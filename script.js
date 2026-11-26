"use strict";

/* 合計を100%とみなす誤差：0.01ポイント */
const tolerance = 0.01;

let layoutMode = "flex";
let latestCalculation = null;
let copyTimer = null;

const elements = {
  form: document.querySelector("#ratioForm"),

  parent: document.querySelector("#parentWidth"),
  paddingLeft: document.querySelector("#paddingLeft"),
  paddingRight: document.querySelector("#paddingRight"),
  text: document.querySelector("#textWidth"),
  gap: document.querySelector("#gapWidth"),
  map: document.querySelector("#mapWidth"),

  parentError: document.querySelector("#parentError"),
  formMessage: document.querySelector("#formMessage"),

  textResult: document.querySelector("#textResult"),
  gapResult: document.querySelector("#gapResult"),
  mapResult: document.querySelector("#mapResult"),
  paddingLeftResult: document.querySelector("#paddingLeftResult"),
  paddingRightResult: document.querySelector("#paddingRightResult"),
  totalResult: document.querySelector("#totalResult"),
  innerWidthNote: document.querySelector("#innerWidthNote"),

  status: document.querySelector("#totalStatus"),
  statusText: document.querySelector("#statusText"),
  statusIcon: document.querySelector(".status-icon"),
  difference: document.querySelector("#differenceText"),

  ratioVisual: document.querySelector("#ratioVisual"),
  textSegment: document.querySelector("#textSegment"),
  gapSegment: document.querySelector("#gapSegment"),
  mapSegment: document.querySelector("#mapSegment"),

  layoutSummary: document.querySelector("#layoutSummary"),
  cssOutput: document.querySelector("#cssOutput"),

  copyButton: document.querySelector("#copyButton"),
  copyButtonText: document.querySelector("#copyButtonText"),
  resetButton: document.querySelector("#resetButton"),
};

const inputs = [
  elements.parent,
  elements.paddingLeft,
  elements.paddingRight,
  elements.text,
  elements.gap,
  elements.map,
];

const layoutOptions = [
  ...document.querySelectorAll(".layout-option"),
];

/* 数値を読み取る */
function readNumber(input) {
  if (input.value.trim() === "") {
    return NaN;
  }

  return Number(input.value);
}

/* 計算結果は小数第4位まで表示 */
function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${Number(value.toFixed(4))}%`;
}

/* CSSは小数第2位まで出力 */
function cssNumber(value) {
  return Number(value.toFixed(2));
}

/* 入力欄のエラー状態 */
function setInvalid(input, isInvalid) {
  input.setAttribute("aria-invalid", String(isInvalid));
}

/* コピー完了の表示を戻す */
function resetCopyLabel() {
  window.clearTimeout(copyTimer);
  elements.copyButtonText.textContent = "CSSをコピー";
}

/* 結果を空にする */
function clearOutput() {
  latestCalculation = null;

  [
    elements.textResult,
    elements.gapResult,
    elements.mapResult,
    elements.paddingLeftResult,
    elements.paddingRightResult,
    elements.totalResult,
  ].forEach((node) => {
    node.textContent = "—";
  });

  [
    elements.textSegment,
    elements.gapSegment,
    elements.mapSegment,
  ].forEach((node) => {
    node.style.width = "0%";
  });

  elements.ratioVisual.setAttribute(
    "aria-label",
    "幅を入力すると要素の比率を表示します"
  );

  if (elements.layoutSummary) {
    elements.layoutSummary.textContent =
      "幅を入力すると、各要素の割合とCSSが表示されます。";
  }

  elements.cssOutput.textContent =
    "/* 幅を入力するとCSSを生成します */";

  elements.copyButton.disabled = true;
}

/* 入力待ち・エラー状態を表示 */
function showInputStatus(hasError) {
  elements.status.classList.remove("is-warning", "is-error");

  if (hasError) {
    elements.status.classList.add("is-error");
  }

  elements.statusIcon.textContent = hasError ? "!" : "—";

  elements.statusText.textContent = hasError
    ? "入力を確認"
    : "入力待ち";

  elements.difference.textContent = hasError
    ? "入力内容を確認してください。"
    : "外幅とテキスト・間隔・画像の幅を入力すると計算できます。";
}

/* 合計の状態を表示 */
function updateStatus(total) {
  const difference = total - 100;

  elements.status.classList.remove("is-warning", "is-error");

  if (Math.abs(difference) <= tolerance) {
    elements.statusIcon.textContent = "✓";
    elements.statusText.textContent = "合計 約100%";

    elements.difference.textContent =
      "内側の幅にほぼぴったり収まっています。";

    return;
  }

  elements.status.classList.add("is-warning");
  elements.statusIcon.textContent = "!";

  if (difference > 0) {
    elements.statusText.textContent = "100%を超過";

    elements.difference.textContent =
      `内側の幅を ${formatPercent(difference)} 超えています。`;
  } else {
    elements.statusText.textContent = "100%未満";

    elements.difference.textContent =
      `内側の幅に対して ${formatPercent(-difference)} 余っています。`;
  }
}

/* 比率プレビューを更新 */
function updateVisual(percentages, total) {
  /*
   * 100%未満なら、余りも見えるように表示します。
   * 100%を超える場合は、全体を縮小して表示します。
   */
  const visualScale = Math.max(100, total);

  const segments = [
    elements.textSegment,
    elements.gapSegment,
    elements.mapSegment,
  ];

  elements.ratioVisual.style.display = "flex";
  elements.ratioVisual.style.overflow = "hidden";

  segments.forEach((segment, index) => {
    segment.style.flex = "0 0 auto";
    segment.style.minWidth = "0";
    segment.style.width =
      `${(percentages[index] / visualScale) * 100}%`;
    segment.style.overflow = "hidden";
  });

  const [text, gap, map] = percentages;

  const note = total > 100
    ? "。合計が100%を超えるためプレビューは縮小表示"
    : "";

  elements.ratioVisual.setAttribute(
    "aria-label",
    `テキスト ${formatPercent(text)}、` +
      `間隔 ${formatPercent(gap)}、` +
      `地図 ${formatPercent(map)}${note}`
  );
}

/* コメント付きCSSを生成 */
function generateCss(percentages, total, layoutData) {
  const [text, gap, map] = percentages.map(cssNumber);
  const paddingLeft = cssNumber(layoutData.paddingLeftPercent);
  const paddingRight = cssNumber(layoutData.paddingRightPercent);

  const roundedTotal = cssNumber(text + gap + map);

  if (elements.layoutSummary) {
    elements.layoutSummary.textContent =
      `内側 ${layoutData.innerWidth}px：` +
      `テキスト ${text}% ＋ 間隔 ${gap}% ＋ 地図 ${map}%` +
      ` ＝ ${roundedTotal}%`;
  }

  const notes = [];

  if (Math.abs(total - 100) > tolerance) {
    notes.push("入力値の合計が100%ではありません。");
  }

  if (Math.abs(roundedTotal - 100) > 0.000001) {
    notes.push(
      "出力値の合計が100%ではないため、余りやはみ出しが生じます。"
    );
  }

  const warning = notes.length > 0
    ? `\n/* 注意：${notes.join(" ")} */`
    : "";

  const summary = `/* レイアウトの割合
   外幅　　：${layoutData.outerWidth}px
   左余白　：${layoutData.paddingLeft}px（外幅の${paddingLeft}%）
   右余白　：${layoutData.paddingRight}px（外幅の${paddingRight}%）
   内側幅　：${layoutData.innerWidth}px
   テキスト：${text}%
   間隔　　：${gap}%
   地図　　：${map}%
   合計　　：${roundedTotal}%
*/${warning}`;

  if (layoutMode === "flex") {
    elements.cssOutput.textContent = `${summary}

/* テキストと地図を囲む親要素 */
.layout {
  display: flex;

  /* 左右のパディング（外幅に対する割合） */
  padding-left: ${paddingLeft}%;
  padding-right: ${paddingRight}%;

  /* テキストと地図の間隔 */
  column-gap: ${gap}%;
}

/* 左側：テキスト */
.layout__text {
  width: ${text}%;

  /* 余白があっても幅を広げない */
  flex-grow: 0;

  /* 指定した幅より縮めない */
  flex-shrink: 0;

  /* 内容による最小幅の制限を解除する */
  min-width: 0;
}

/* 右側：地図 */
.layout__map {
  width: ${map}%;

  /* 余白があっても幅を広げない */
  flex-grow: 0;

  /* 指定した幅より縮めない */
  flex-shrink: 0;

  /* 内容による最小幅の制限を解除する */
  min-width: 0;
}`;

    return;
  }

  elements.cssOutput.textContent = `${summary}

/* テキストと地図を囲む親要素 */
.layout {
  display: grid;

  /* 左右のパディング（外幅に対する割合） */
  padding-left: ${paddingLeft}%;
  padding-right: ${paddingRight}%;

  /* 左側：テキスト ／ 右側：地図 */
  grid-template-columns: ${text}% ${map}%;

  /* テキストと地図の間隔 */
  column-gap: ${gap}%;
}

/* 左側のテキストと右側の地図 */
.layout__text,
.layout__map {
  /* 内容による最小幅の制限を解除する */
  min-width: 0;
}`;
}

/* 入力値を計算して表示 */
function calculate() {
  resetCopyLabel();

  const parent = readNumber(elements.parent);
  const paddingLeft = elements.paddingLeft.value.trim() === ""
    ? 0
    : readNumber(elements.paddingLeft);
  const paddingRight = elements.paddingRight.value.trim() === ""
    ? 0
    : readNumber(elements.paddingRight);

  const childInputs = [
    elements.text,
    elements.gap,
    elements.map,
  ];

  const values = childInputs.map(readNumber);

  const parentHasValue =
    elements.parent.value.trim() !== "" ||
    elements.parent.validity.badInput;

  const parentInvalid =
    parentHasValue &&
    (!Number.isFinite(parent) || parent <= 0);

  elements.parentError.textContent = parentInvalid
    ? "親要素の幅は0より大きい数値を入力してください。"
    : "";

  setInvalid(elements.parent, parentInvalid);

  let childInvalid = false;

  childInputs.forEach((input, index) => {
    const hasValue =
      input.value.trim() !== "" ||
      input.validity.badInput;

    const invalid =
      hasValue &&
      (!Number.isFinite(values[index]) || values[index] < 0);

    setInvalid(input, invalid);

    if (invalid) {
      childInvalid = true;
    }
  });

  const paddingInvalid = [
    [elements.paddingLeft, paddingLeft],
    [elements.paddingRight, paddingRight],
  ].some(([input, value]) => {
    const hasValue = input.value.trim() !== "" || input.validity.badInput;
    const invalid = hasValue && (!Number.isFinite(value) || value < 0);
    setInvalid(input, invalid);
    return invalid;
  });

  const innerWidth = parent - paddingLeft - paddingRight;
  const innerWidthInvalid =
    Number.isFinite(parent) && parent > 0 && innerWidth <= 0;

  elements.innerWidthNote.textContent =
    Number.isFinite(parent) && parent > 0 && !innerWidthInvalid
      ? `内側の幅：${parent} − ${paddingLeft} − ${paddingRight} ＝ ${innerWidth}px`
      : "内側の幅：外幅 − 左右のパディング";

  const requiredInputs = [elements.parent, ...childInputs];
  const hasEmptyInput = requiredInputs.some(
    (input) => input.value.trim() === ""
  );

  if (paddingInvalid || innerWidthInvalid) {
    elements.formMessage.textContent = innerWidthInvalid
      ? "左右のパディングの合計は、親要素の外幅より小さくしてください。"
      : "パディングには0以上の数値を入力してください。";
  } else if (childInvalid) {
    elements.formMessage.textContent =
      "テキスト・間隔・地図には0以上の数値を入力してください。";
  } else if (hasEmptyInput && !parentInvalid) {
    elements.formMessage.textContent =
      "4つの幅をすべて入力してください。";
  } else {
    elements.formMessage.textContent = "";
  }

  if (
    parentInvalid || childInvalid || paddingInvalid ||
    innerWidthInvalid || hasEmptyInput
  ) {
    clearOutput();
    showInputStatus(
      parentInvalid || childInvalid || paddingInvalid || innerWidthInvalid
    );
    return;
  }

  const percentages = values.map(
    (value) => (value / innerWidth) * 100
  );

  const paddingLeftPercent = (paddingLeft / parent) * 100;
  const paddingRightPercent = (paddingRight / parent) * 100;

  const total = percentages.reduce(
    (sum, value) => sum + value,
    0
  );

  if (
    !percentages.every(Number.isFinite) ||
    !Number.isFinite(total)
  ) {
    elements.formMessage.textContent =
      "数値が大きすぎるため計算できません。入力値を確認してください。";

    clearOutput();
    showInputStatus(true);
    return;
  }

  elements.textResult.textContent =
    formatPercent(percentages[0]);

  elements.gapResult.textContent =
    formatPercent(percentages[1]);

  elements.mapResult.textContent =
    formatPercent(percentages[2]);
  elements.paddingLeftResult.textContent =
    `${paddingLeft}px ／ ${formatPercent(paddingLeftPercent)}`;
  elements.paddingRightResult.textContent =
    `${paddingRight}px ／ ${formatPercent(paddingRightPercent)}`;

  elements.totalResult.textContent =
    formatPercent(total);

  updateStatus(total);
  updateVisual(percentages, total);

  latestCalculation = {
    percentages,
    total,
    outerWidth: parent,
    innerWidth,
    paddingLeft,
    paddingRight,
    paddingLeftPercent,
    paddingRightPercent,
  };

  generateCss(percentages, total, latestCalculation);

  elements.copyButton.disabled = false;
}

/* Flex／Gridを切り替える */
function switchLayoutMode(mode) {
  if (mode !== "flex" && mode !== "grid") {
    return;
  }

  layoutMode = mode;
  resetCopyLabel();

  layoutOptions.forEach((button) => {
    const isActive = button.dataset.mode === mode;

    button.classList.toggle("is-active", isActive);
    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });

  if (latestCalculation) {
    generateCss(
      latestCalculation.percentages,
      latestCalculation.total,
      latestCalculation
    );
  }
}

/* Clipboard APIが使えない場合のコピー */
function fallbackCopy(text) {
  const previousFocus = document.activeElement;
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);

  let succeeded = false;

  try {
    textarea.focus();
    textarea.select();
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  } finally {
    textarea.remove();

    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  }

  return succeeded;
}

/* CSSをコピー */
async function copyCss() {
  if (elements.copyButton.disabled) {
    return;
  }

  resetCopyLabel();

  const css = elements.cssOutput.textContent;
  let succeeded = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(css);
      succeeded = true;
    }
  } catch {
    succeeded = false;
  }

  if (!succeeded) {
    succeeded = fallbackCopy(css);
  }

  elements.copyButtonText.textContent = succeeded
    ? "コピーしました"
    : "コードを選択してコピーしてください";

  copyTimer = window.setTimeout(() => {
    elements.copyButtonText.textContent = "CSSをコピー";
  }, 2200);
}

/* 入力をクリア */
function reset() {
  inputs.forEach((input) => {
    input.value = "";
  });

  calculate();
  elements.parent.focus();
}

/* 入力するたびに再計算 */
inputs.forEach((input) => {
  input.addEventListener("input", calculate);
});

/* Enterキーでの再読み込みを防ぐ */
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
});

elements.copyButton.addEventListener("click", copyCss);
elements.resetButton.addEventListener("click", reset);

layoutOptions.forEach((button) => {
  button.addEventListener("click", () => {
    switchLayoutMode(button.dataset.mode);
  });
});

/* 最初の表示 */
calculate();
