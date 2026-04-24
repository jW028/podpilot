"use client";

import React, { useEffect, useState } from "react";
import { Draggable } from "react-beautiful-dnd";

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

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case "text":
        return "📝";
      case "textarea":
        return "📄";
      case "number":
        return "🔢";
      case "image":
        return "🖼️";
      case "selection":
        return "📋";
      default:
        return "📦";
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "text":
        return "bg-blue-50 border-blue-300 hover:border-blue-400";
      case "textarea":
        return "bg-indigo-50 border-indigo-300 hover:border-indigo-400";
      case "number":
        return "bg-purple-50 border-purple-300 hover:border-purple-400";
      case "image":
        return "bg-green-50 border-green-300 hover:border-green-400";
      case "selection":
        return "bg-orange-50 border-orange-300 hover:border-orange-400";
      default:
        return "bg-neutral-50 border-neutral-300 hover:border-neutral-400";
    }
  };

  const handleUpdate = () => {
    onUpdate({ ...block, value: localValue });
  };

  const handleValueChange = (value: string | number | string[]) => {
    setLocalValue(value);
  };

  return (
    <Draggable draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`border-2 rounded-lg p-4 transition-all ${getTypeColor(
            block.type,
          )} ${
            snapshot.isDragging
              ? "shadow-lg scale-105 bg-opacity-90"
              : "shadow-sm"
          }`}
          style={{
            ...provided.draggableProps.style,
            cursor: snapshot.isDragging ? "grabbing" : "grab",
          }}
        >
          {/* Header with drag handle and info */}
          <div
            {...provided.dragHandleProps}
            className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">{getTypeIcon(block.type)}</span>
              <div className="flex-1">
                <p className="font-semibold text-dark text-sm">{block.label}</p>
                <p className="text-xs text-neutral-500">{block.name}</p>
              </div>
              {block.required && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                  Required
                </span>
              )}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 px-2 py-1 text-xs bg-neutral-200 hover:bg-neutral-300 rounded transition-colors"
            >
              {isExpanded ? "✕" : "✎"}
            </button>
          </div>

          {/* Editable Content */}
          {isExpanded ? (
            <div className="space-y-2 mb-3">
              {block.type === "text" && (
                <input
                  type="text"
                  value={typeof localValue === "string" ? localValue : ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  onBlur={handleUpdate}
                  placeholder={block.placeholder || "Enter text..."}
                  className="w-full px-3 py-2 border border-neutral-400 rounded bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50"
                  autoFocus
                />
              )}

              {block.type === "textarea" && (
                <textarea
                  value={typeof localValue === "string" ? localValue : ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  onBlur={handleUpdate}
                  placeholder={block.placeholder || "Enter description..."}
                  rows={4}
                  className="w-full px-3 py-2 border border-neutral-400 rounded bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50 resize-none"
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
                  onBlur={handleUpdate}
                  placeholder="Enter number..."
                  className="w-full px-3 py-2 border border-neutral-400 rounded bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50"
                  autoFocus
                />
              )}

              {block.type === "image" && (
                <input
                  type="text"
                  value={typeof localValue === "string" ? localValue : ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  onBlur={handleUpdate}
                  placeholder="Supabase image URL..."
                  className="w-full px-3 py-2 border border-neutral-400 rounded bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50 font-mono text-xs"
                  autoFocus
                />
              )}

              {block.type === "selection" && (
                <div>
                  <select
                    value={Array.isArray(localValue) ? localValue[0] : ""}
                    onChange={(e) => handleValueChange([e.target.value])}
                    onBlur={handleUpdate}
                    className="w-full px-3 py-2 border border-neutral-400 rounded bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50"
                    autoFocus
                  >
                    <option value="">Select an option...</option>
                    {block.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-neutral-700 truncate">
              {localValue ? (
                String(localValue).substring(0, 50)
              ) : (
                <span className="italic text-neutral-400">No value</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-current border-opacity-20">
            {isExpanded && (
              <>
                <button
                  onClick={handleUpdate}
                  className="flex-1 px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                >
                  Save
                </button>
                {onRemove && (
                  <button
                    onClick={() => onRemove(block.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default EditableBlock;
