import { Check, ChevronDown, Plus, Search, X, type LucideIcon } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  keywords?: string;
}

export interface ComboboxSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowCustom?: boolean;
  customActionLabel?: (text: string) => string;
  className?: string;
  emptyText?: string;
}

export function ComboboxSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  disabled = false,
  allowCustom = false,
  customActionLabel,
  className,
  emptyText = "No matching options found",
}: ComboboxSelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Currently selected option object
  const selectedOption = useMemo(
    () => options.find((o) => o.value.toLowerCase() === value.toLowerCase()),
    [options, value],
  );

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.keywords && opt.keywords.toLowerCase().includes(q)),
    );
  }, [options, search]);

  const canAddCustom = useMemo(() => {
    if (!allowCustom || !search.trim()) return false;
    const q = search.trim().toLowerCase();
    return !options.some((o) => o.value.toLowerCase() === q);
  }, [allowCustom, search, options]);

  // Total selectable items (filtered + custom add row)
  const totalItems = filteredOptions.length + (canAddCustom ? 1 : 0);

  // Handle open / close
  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch("");
    setHighlightIndex(-1);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearch("");
    setHighlightIndex(-1);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, handleClose]);

  // Focus search input when opened
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1 >= totalItems ? 0 : prev + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev - 1 < 0 ? totalItems - 1 : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
          const item = filteredOptions[highlightIndex];
          if (item && !item.disabled) {
            onChange(item.value);
            handleClose();
          }
        } else if (canAddCustom && highlightIndex === filteredOptions.length) {
          onChange(search.trim());
          handleClose();
        } else if (filteredOptions.length === 1) {
          const single = filteredOptions[0];
          if (single && !single.disabled) {
            onChange(single.value);
            handleClose();
          }
        } else if (canAddCustom && filteredOptions.length === 0) {
          onChange(search.trim());
          handleClose();
        }
        break;
    }
  };

  const selectItem = (val: string) => {
    onChange(val);
    handleClose();
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full text-left", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => (open ? handleClose() : handleOpen())}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-elevated/70 px-3.5 py-2 text-sm text-foreground shadow-sm transition-all select-none cursor-pointer",
          "hover:border-border hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
          open && "ring-2 ring-primary/25 border-primary bg-elevated",
          disabled && "cursor-not-allowed opacity-50 bg-muted/30 border-border/40",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption?.icon ? (
            <selectedOption.icon className="size-4 shrink-0 text-primary" aria-hidden />
          ) : null}

          {value ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-foreground">
                {selectedOption?.label || value}
              </span>
              {selectedOption?.badge ? (
                <div className="shrink-0">{selectedOption.badge}</div>
              ) : null}
            </div>
          ) : (
            <span className="truncate text-muted-foreground/70">{placeholder}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pl-1">
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={clearSelection}
              onKeyDown={(e) => e.key === "Enter" && clearSelection(e as unknown as React.MouseEvent)}
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="size-3.5" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180 text-primary",
            )}
            aria-hidden
          />
        </div>
      </button>

      {/* Floating Dropdown Menu */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-full min-w-[280px] rounded-2xl border border-border/90 bg-popover/98 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-2xl transition-all duration-150 animate-in fade-in-0 zoom-in-95",
            "max-w-[calc(100vw-2rem)]",
          )}
          style={{ maxHeight: "min(360px, 70vh)" }}
        >
          {/* Search Box */}
          <div className="relative mb-1 px-1 pt-0.5">
            <Search
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(-1);
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-xl border border-border/70 bg-elevated/80 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/20"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="overflow-y-auto overflow-x-hidden p-0.5 space-y-0.5 max-h-[260px] dropdown-scroll"
            role="listbox"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value.toLowerCase() === value.toLowerCase();
                const isHighlighted = idx === highlightIndex;
                const IconComponent = opt.icon;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => !opt.disabled && selectItem(opt.value)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={cn(
                      "group flex w-full min-h-[42px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-all cursor-pointer select-none",
                      isSelected
                        ? "bg-primary/15 text-primary font-semibold"
                        : isHighlighted
                          ? "bg-accent/80 text-foreground"
                          : "text-foreground hover:bg-accent/60",
                      opt.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {IconComponent ? (
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isSelected
                              ? "bg-primary/20 text-primary"
                              : "bg-elevated text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <IconComponent className="size-3.5" />
                        </div>
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.sublabel ? (
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5 font-normal">
                            {opt.sublabel}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {opt.badge}
                      {isSelected ? (
                        <Check className="size-4 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : !canAddCustom ? (
              <div className="py-6 px-3 text-center">
                <p className="text-xs text-muted-foreground">{emptyText}</p>
              </div>
            ) : null}

            {/* Custom Add Action (if allowCustom is active) */}
            {canAddCustom ? (
              <div
                role="option"
                onClick={() => selectItem(search.trim())}
                onMouseEnter={() => setHighlightIndex(filteredOptions.length)}
                className={cn(
                  "flex min-h-[42px] items-center gap-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary transition-all cursor-pointer font-medium",
                  highlightIndex === filteredOptions.length && "bg-primary/15 border-primary",
                )}
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary">
                  <Plus className="size-3.5" />
                </div>
                <span className="truncate">
                  {customActionLabel
                    ? customActionLabel(search.trim())
                    : `Add "${search.trim()}"`}
                </span>
              </div>
            ) : null}
          </div>

          {/* Footer count */}
          {options.length > 5 ? (
            <div className="border-t border-border/60 mt-1 px-3 py-1 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>{filteredOptions.length} of {options.length} options</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/60 text-[9px] uppercase text-muted-foreground">
                Esc to close
              </kbd>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
