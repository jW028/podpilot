"use client";

import React from "react";

// ── Inline parser: **bold**, *italic* ────────────────────────────────────────
const parseInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // **bold**
      parts.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      // *italic*
      parts.push(<em key={`${keyPrefix}-i${i}`}>{match[2]}</em>);
    }

    lastIndex = regex.lastIndex;
    i += 1;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

// ── Block parser: bullet lists, ordered lists, paragraphs ────────────────────
const MarkdownText = ({ content }: { content: string }) => {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let orderedBuffer: string[] = [];

  const flushBullet = () => {
    if (!bulletBuffer.length) return;
    elements.push(
      <ul
        key={`ul-${elements.length}`}
        className="list-disc pl-5 space-y-0.5 my-1"
      >
        {bulletBuffer.map((item, i) => (
          <li key={i}>{parseInline(item, `li-${i}`)}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  const flushOrdered = () => {
    if (!orderedBuffer.length) return;
    elements.push(
      <ol
        key={`ol-${elements.length}`}
        className="list-decimal pl-5 space-y-0.5 my-1"
      >
        {orderedBuffer.map((item, i) => (
          <li key={i}>{parseInline(item, `oli-${i}`)}</li>
        ))}
      </ol>,
    );
    orderedBuffer = [];
  };

  lines.forEach((line, index) => {
    const bulletMatch = line.match(/^[-•*]\s+(.+)/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)/);

    if (bulletMatch) {
      flushOrdered();
      bulletBuffer.push(bulletMatch[1]);
    } else if (orderedMatch) {
      flushBullet();
      orderedBuffer.push(orderedMatch[1]);
    } else if (line.trim() === "") {
      // Blank line: only flush + add gap when NOT inside an active list.
      // Inside a list, blank lines between items are ignored so items
      // stay in one <ol>/<ul> and number correctly (1, 2, 3…).
      if (!bulletBuffer.length && !orderedBuffer.length) {
        if (elements.length > 0) {
          elements.push(<div key={`gap-${index}`} className="h-1" />);
        }
      }
    } else {
      // Real paragraph content — flush any active list first, then add paragraph
      flushBullet();
      flushOrdered();
      elements.push(
        <p key={`p-${index}`} className="leading-relaxed">
          {parseInline(line, `p-${index}`)}
        </p>,
      );
    }
  });

  // flush any trailing list
  flushBullet();
  flushOrdered();

  return <div className="space-y-0.5">{elements}</div>;
};

export default MarkdownText;
