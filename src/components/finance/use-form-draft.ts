"use client";

import * as React from "react";

/**
 * Keeps what someone has typed, so closing a dialog or wandering off does not
 * throw the work away.
 *
 * Values live in localStorage under a per-form key, are restored when the form
 * mounts, and are cleared the moment the record saves. Nothing is written to
 * the server — a half-filled form is not a record.
 *
 * Restoring uses the native value setter plus an `input` event rather than
 * assigning `.value`, which is what makes it reach React's controlled inputs
 * as well as plain uncontrolled ones.
 */

const PREFIX = "foxwel-finance:draft:";

type DraftValues = Record<string, string | boolean>;

function readDraft(key: string): DraftValues | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as DraftValues;
  } catch {
    // Private windows and blocked site data both throw. A draft is a nicety.
    return null;
  }
}

function writeDraft(key: string, values: DraftValues) {
  try {
    if (Object.keys(values).length === 0) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(values));
  } catch {
    /* storage unavailable or full — carry on without a draft */
  }
}

function removeDraft(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Fields whose value is either meaningless or unsafe to keep lying around. */
function isPersistable(element: Element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (!element.name) return false;
  if (element instanceof HTMLInputElement) {
    // Never keep a password, and a hidden field is set by the code, not typed.
    if (element.type === "password" || element.type === "hidden" || element.type === "file") return false;
  }
  return true;
}

function collect(form: HTMLFormElement): DraftValues {
  const values: DraftValues = {};
  for (const element of Array.from(form.elements)) {
    if (!isPersistable(element)) continue;
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      // Radios share a name; only the selected one is worth keeping.
      if (element.checked) values[`${element.name}::${element.value}`] = true;
      continue;
    }
    if (element.value !== "") values[element.name] = element.value;
  }
  return values;
}

function setNativeValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function restore(form: HTMLFormElement, values: DraftValues): boolean {
  let restoredAnything = false;

  for (const element of Array.from(form.elements)) {
    if (!isPersistable(element)) continue;

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      const wanted = values[`${element.name}::${element.value}`] === true;
      if (wanted && !element.checked) {
        // click() so React's onChange handlers see it, not just the DOM.
        element.click();
        restoredAnything = true;
      }
      continue;
    }

    const saved = values[element.name];
    if (typeof saved === "string" && saved !== "" && element.value !== saved) {
      setNativeValue(element, saved);
      restoredAnything = true;
    }
  }

  return restoredAnything;
}

export function useFormDraft(key: string | null) {
  const [form, setForm] = React.useState<HTMLFormElement | null>(null);
  const [restored, setRestored] = React.useState(false);

  /**
   * A ref callback rather than a ref object plus an effect: the form lives
   * inside a dialog and only exists once that dialog opens, so this is the
   * exact moment to put the draft back and start watching for changes. React 19
   * runs the returned function when the node goes away.
   */
  const formRef = React.useCallback(
    (node: HTMLFormElement | null) => {
      setForm(node);

      if (!node || !key) {
        setRestored(false);
        return;
      }

      const saved = readDraft(key);
      setRestored(saved !== null && restore(node, saved));

      let timer: ReturnType<typeof setTimeout> | undefined;
      const save = () => {
        clearTimeout(timer);
        timer = setTimeout(() => writeDraft(key, collect(node)), 300);
      };

      node.addEventListener("input", save);
      node.addEventListener("change", save);

      return () => {
        clearTimeout(timer);
        node.removeEventListener("input", save);
        node.removeEventListener("change", save);
      };
    },
    [key],
  );

  const clear = React.useCallback(() => {
    if (key) removeDraft(key);
    setRestored(false);
  }, [key]);

  /** Put every field back to what the form opened with, and forget the draft. */
  const discard = React.useCallback(() => {
    if (form) {
      for (const element of Array.from(form.elements)) {
        if (!isPersistable(element)) continue;

        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          if (element.checked !== element.defaultChecked) element.click();
          continue;
        }

        // A <select> has no defaultValue; its initial choice is the option
        // marked selected, or failing that the first one.
        const initial =
          element instanceof HTMLSelectElement
            ? (Array.from(element.options).find((option) => option.defaultSelected)?.value ??
              element.options[0]?.value ??
              "")
            : element.defaultValue;
        if (element.value !== initial) setNativeValue(element, initial);
      }
    }
    clear();
  }, [clear, form]);

  return { formRef, restored, clear, discard };
}
