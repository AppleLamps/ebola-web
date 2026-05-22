function getBounds(timeline) {
  const maxValue = Math.max(...timeline.map((point) => point.confirmed));
  return {
    minY: 0,
    maxY: Math.ceil(maxValue * 1.1),
  };
}

function mapPoint({ value, index, total, width, height, padding, bounds }) {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const x = padding + (usableWidth * index) / Math.max(total - 1, 1);
  const ratio = (value - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 1);
  const y = height - padding - ratio * usableHeight;
  return { x, y };
}

function maxActivity(timeline) {
  return Math.max(
    1,
    ...timeline.map((point) => Math.max(point.humanitarianCount ?? 0, point.whoCount ?? 0)),
  );
}

function drawBars(context, timeline, width, height, padding) {
  const activityMax = maxActivity(timeline);
  const total = timeline.length;
  const usableWidth = width - padding * 2;
  const activityTop = height - 84;
  const activityBottom = height - 28;
  const activityHeight = activityBottom - activityTop;

  timeline.forEach((point, index) => {
    const centerX = padding + (usableWidth * index) / Math.max(total - 1, 1);
    const barWidth = Math.max(4, usableWidth / Math.max(total * 2.8, 1));
    const humanitarianHeight = ((point.humanitarianCount ?? 0) / activityMax) * activityHeight;
    const whoHeight = ((point.whoCount ?? 0) / activityMax) * activityHeight;

    context.fillStyle = "rgba(51, 209, 255, 0.45)";
    context.fillRect(centerX - barWidth - 1, activityBottom - humanitarianHeight, barWidth, humanitarianHeight);

    context.fillStyle = "rgba(255, 107, 107, 0.55)";
    context.fillRect(centerX + 1, activityBottom - whoHeight, barWidth, whoHeight);
  });

  context.strokeStyle = "rgba(180, 201, 227, 0.2)";
  context.beginPath();
  context.moveTo(padding, activityTop);
  context.lineTo(width - padding, activityTop);
  context.stroke();

  context.fillStyle = "#9cb1cc";
  context.font = "11px Segoe UI";
  context.fillText("ReliefWeb", padding, height - 14);
  context.fillStyle = "#ff9a9a";
  context.fillText("WHO DON", padding + 70, height - 14);
}

function drawXAxisLabels(context, timeline, width, height, padding) {
  const usableWidth = width - padding * 2;
  const step = Math.max(1, Math.floor(timeline.length / 5));

  context.fillStyle = "#9cb1cc";
  context.font = "11px Segoe UI";
  context.textAlign = "center";

  timeline.forEach((point, index) => {
    if (index % step !== 0 && index !== timeline.length - 1) {
      return;
    }

    const x = padding + (usableWidth * index) / Math.max(timeline.length - 1, 1);
    context.fillText(point.date.slice(5), x, height - 88);
  });

  context.textAlign = "start";
}

export function renderTrendChart(canvas, timeline) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 32;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#0a1220";
  context.fillRect(0, 0, width, height);

  const bounds = getBounds(timeline);
  context.strokeStyle = "rgba(180, 201, 227, 0.25)";
  context.lineWidth = 1;

  for (let i = 0; i < 4; i += 1) {
    const y = padding + ((height - padding * 2) * i) / 3;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  drawBars(context, timeline, width, height, padding);
  drawXAxisLabels(context, timeline, width, height, padding);

  context.beginPath();
  timeline.forEach((point, index) => {
    const mapped = mapPoint({
      value: point.confirmed,
      index,
      total: timeline.length,
      width,
      height,
      padding,
      bounds,
    });

    if (index === 0) {
      context.moveTo(mapped.x, mapped.y);
    } else {
      context.lineTo(mapped.x, mapped.y);
    }
  });

  context.strokeStyle = "#33d1ff";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "#dbeeff";
  context.font = "12px Segoe UI";
  const last = timeline.at(-1);
  if (last) {
    context.fillText(
      `Latest confirmed: ${last.confirmed} · ReliefWeb ${last.humanitarianCount ?? 0} · WHO ${last.whoCount ?? 0}`,
      padding,
      height - 10,
    );
  }
}
