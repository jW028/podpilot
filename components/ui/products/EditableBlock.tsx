"use client";

import React, { useEffect, useState, useRef } from "react";
import { Draggable } from "@hello-pangea/dnd";
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
  MdLock,
  MdCloudUpload,
} from "react-icons/md";

export interface Block {
  id: string;
  name: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "image"
    | "selection"
    | "multi-selection";
  label: string;
  value: string | number | string[] | null;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  locked?: boolean;
}

interface EditableBlockProps {
  block: Block;
  index: number;
  onUpdate: (block: Block) => void;
  onRemove?: (blockId: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
}

const getTypeIcon = (type: string, locked?: boolean) => {
  if (locked) {
    return <MdLock className="text-neutral-400 text-sm" />;
  }
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
    case "multi-selection":
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
  onImageUpload,
}: EditableBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(block.value);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalValue(block.value);
    }, 0);
    return () => clearTimeout(timer);
  }, [block.value]);

  const handleUpdate = () => {
    onUpdate({ ...block, value: localValue });
    setIsExpanded(false);
  };

  const handleValueChange = (value: string | number | string[]) => {
    setLocalValue(value);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;

    try {
      setIsUploading(true);
      const url = await onImageUpload(file);
      if (url) {
        setLocalValue(url);
        onUpdate({ ...block, value: url });
      }
    } catch (error) {
      console.error("Image upload failed:", error);
    } finally {
      setIsUploading(false);
      // Reset so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const displayValue = Array.isArray(localValue)
    ? localValue.join(", ").substring(0, 60) || null
    : localValue
      ? String(localValue).substring(0, 60)
      : null;

  const isLocked = block.locked === true;

  return (
    <Draggable draggableId={block.id} index={index} isDragDisabled={isLocked}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-white border rounded-xl p-3.5 transition-all select-none ${
            isLocked
              ? "border-neutral-200 opacity-75"
              : snapshot.isDragging
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
              className={`mt-0.5 flex-shrink-0 transition-colors ${
                isLocked
                  ? "text-neutral-200 cursor-not-allowed"
                  : "text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing"
              }`}
            >
              <MdDragIndicator className="text-base" />
            </div>

            {/* Type icon + label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {getTypeIcon(block.type, isLocked)}
                <p className="font-semibold text-dark text-xs leading-tight truncate">
                  {block.label}
                </p>
                {block.required && (
                  <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                    Required
                  </span>
                )}
                {isLocked && (
                  <span className="text-[9px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                    Fixed
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 truncate">
                {block.name}
              </p>
            </div>

            {/* Edit / close toggle — hidden for locked fields */}
            {!isLocked && (
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
            )}
          </div>

          {/* ── Editable Content ──────────────────────────── */}
          {isExpanded && !isLocked ? (
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
                  step="0.01"
                  value={typeof localValue === "number" ? localValue : ""}
                  onChange={(e) =>
                    handleValueChange(
                      e.target.value ? parseFloat(e.target.value) : 0,
                    )
                  }
                  placeholder={block.placeholder || "Enter number..."}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  autoFocus
                />
              )}

              {block.type === "image" && (
                <div className="space-y-2">
                  {/* Image preview */}
                  {localValue && typeof localValue === "string" && (
                    <div className="relative rounded-lg overflow-hidden border border-neutral-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={localValue}
                        alt="Product design"
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-neutral-300 rounded-lg text-xs text-neutral-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
                  >
                    <MdCloudUpload className="text-base" />
                    {isUploading ? "Uploading..." : "Upload Image"}
                  </button>

                  {/* URL input fallback */}
                  <input
                    type="text"
                    value={typeof localValue === "string" ? localValue : ""}
                    onChange={(e) => handleValueChange(e.target.value)}
                    placeholder="Or paste image URL..."
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-light-secondary text-dark text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent font-mono transition-all"
                  />
                </div>
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

              {block.type === "multi-selection" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-neutral-400">
                    Select all that apply
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {block.options?.map((opt) => {
                      const selected =
                        Array.isArray(localValue) && localValue.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const current = Array.isArray(localValue)
                              ? localValue
                              : [];
                            handleValueChange(
                              selected
                                ? current.filter((v) => v !== opt)
                                : [...current, opt],
                            );
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                            selected
                              ? "bg-primary-500 text-dark border-primary-500"
                              : "bg-white text-neutral-500 border-neutral-300 hover:border-primary-400 hover:text-primary-600"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {Array.isArray(localValue) && localValue.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleValueChange([])}
                      className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
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
              {block.type === "image" &&
              localValue &&
              typeof localValue === "string" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="relative w-full rounded-lg overflow-hidden border border-neutral-200 group cursor-pointer"
                  title="Click to change image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={localValue}
                    alt="Product design"
                    className="w-full h-20 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <MdCloudUpload className="text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Hidden file input for collapsed-state uploads */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </button>
              ) : block.type === "multi-selection" &&
                Array.isArray(localValue) &&
                localValue.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {localValue.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-[10px] font-medium"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              ) : block.name === "price" && typeof localValue === "number" ? (
                <p className="text-xs text-dark truncate">
                  ${localValue.toFixed(2)}
                </p>
              ) : displayValue ? (
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
