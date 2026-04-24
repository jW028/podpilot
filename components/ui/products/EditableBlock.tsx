"use client";

import React, { useEffect, useState } from "react";
import { Draggable } from "react-beautiful-dnd";
import {
  MdTextFields,
  MdNotes,
  MdTag,
  MdImage,
  MdList,
  MdDragIndicator,
  MdEditNote,
  MdClose,
  MdCheck,
} from "react-icons/md";

export interface Block {
  id: string;
  name: string;
  type: "text" | "textarea" | "number" | "image" | "selection";
  label: string;
  value: string | number | string[] | null;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface EditableBlockProps {
  block: Block;
  index: number;
  onUpdate: (block: Block) => void;
  onRemove?: (blockId: string) => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "text":
      return <MdTextFields className="text-primary-500 text-sm" />;
    case "textarea":
      return <MdNotes className="text-primary-500 text-sm" />;
    case "number":
      return <MdTag className="text-primary-500 text-sm" />;
    case "image":
      return <MdImage className="text-primary-500 text-sm" />;
    case "selection":
      return <MdList className="text-primary-500 text-sm" />;
    default:
      return <MdTextFields className="text-primary-500 text-sm" />;
  }
};

const EditableBlock = ({
  block,
  index,
  onUpdate,
  onRemove,
}: EditableBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(block.value);

  useEffect(() => {
    setLocalValue(block.value);
  }, [block.value]);

  const handleUpdate = () => {
    onUpdate({ ...block, value: localValue });
    setIsExpanded(false);
  };

  const handleValueChange = (value: string | number | string[]) => {
    setLocalValue(value);
  };

  const displayValue = localValue
    ? String(localValue).substring(0, 60)
    : null;

  return (
    <Draggable draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-white border rounded-xl p-3.5 transition-all select-none ${
            snapshot.isDragging
              ? "border-primary-400 shadow-lg scale-[1.02] rotate-1"
              : "border-neutral-300 shadow-sm hover:border-neutral-400 hover:shadow-md"
          }`}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          {/* ── Card Header ───────────────────────────────── */}
          <div className="flex items-start gap-2 mb-2.5">
            {/* Drag handle */}
            <div
              {...provided.dragHandleProps}
              className="mt-0.5 text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
            >
              <MdDragIndicator className="text-base" />
            </div>

            {/* Type icon + label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {getTypeIcon(block.type)}
                <p className="font-semibold text-dark text-xs leading-tight truncate">
                  {block.label}
                </p>
                {block.required && (
                  <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                    Required
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 truncate">{block.name}</p>
            </div>

            {/* Edit / close toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1 rounded-md transition-colors flex-shrink-0 ${
                isExpanded
                  ? "bg-neutral-200 text-dark hover:bg-neutral-300"
                  : "text-neutral-400 hover:text-dark hover:bg-neutral-100"
              }`}
            >
              {isExpanded ? (
                <MdClose className="text-sm" />
              ) : (
                <MdEditNote className="text-sm" />
              )}
            </button>
          </div>

          {/* ── Editable Content ──────────────────────────── */}
          {isExpanded ? (
            <div className="space-y-2">
              {block.type === "text" && (
                <input
                  type="text"
                  value={typeof localValue === "string" ? localValue : ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={block.placeholder || "Enter text..."}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  autoFocus
                />
              )}

              {block.type === "textarea" && (
                <textarea
                  value={typeof localValue === "string" ? localValue : ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={block.placeholder || "Enter description..."}
                  rows={3}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all resize-none"
                  autoFocus
                />
              )}

              {block.type === "number" && (
                <input
                  type="number"
                  value={typeof localValue === "number" ? localValue : ""}
                  onChange={(e) =>
                    handleValueChange(
                      e.target.value ? parseFloat(e.target.value) : 0,
                    )
                  }
                  placeholder="Enter number..."
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  autoFocus
                />
              )}

              {block.type === "image" && (
                <input
                  type="text"
                  value={typeof localValue === "string" ? localValue : ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder="Supabase image URL..."
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent font-mono transition-all"
                  autoFocus
                />
              )}

              {block.type === "selection" && (
                <select
                  value={Array.isArray(localValue) ? localValue[0] : ""}
                  onChange={(e) => handleValueChange([e.target.value])}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  autoFocus
                >
                  <option value="">Select an option...</option>
                  {block.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* Save action */}
              <button
                onClick={handleUpdate}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary-500 text-dark rounded-lg text-xs font-semibold hover:bg-primary-400 transition-colors"
              >
                <MdCheck className="text-sm" />
                Save
              </button>
            </div>
          ) : (
            /* ── Value Preview ──────────────────────────── */
            <div className="mt-1 pb-1 border-b border-neutral-200 min-h-[20px]">
              {displayValue ? (
                <p className="text-xs text-dark truncate">{displayValue}</p>
              ) : (
                <p className="text-xs text-neutral-400 italic">No value</p>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default EditableBlock;
