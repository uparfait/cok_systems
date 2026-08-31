import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { get_field_text, get_parent_linked_options_state, trimmed_lookup, has_real_answer } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useLazyFieldOptions } from "./useLazyFieldOptions.js";

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LocationDataContext = createContext({
  locationTree: null,
  loading: false,
  failed: false,
  retry: () => {},
  language: "en"
});

export function LocationDataProvider({ children, language = "en" }) {
  const [locationTree, setLocationTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      try {
        const response = await fetch(`/dcs/api/locations/all?language=${language}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "Failed to fetch locations");
        }

        setLocationTree(result.data);
        setLoading(false);
        setFailed(false);
        return;
      } catch (err) {
        attempts++;
        console.warn(`Location fetch attempt ${attempts} failed:`, err.message);
        if (attempts < MAX_RETRIES) {
          await wait(RETRY_DELAY * attempts);
        }
      }
    }

    setLoading(false);
    setFailed(true);
  }, [language]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations, retryCount]);

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  return (
    <LocationDataContext.Provider value={{ locationTree, loading, failed, retry, language }}>
      {children}
    </LocationDataContext.Provider>
  );
}

export function useLocationData() {
  return useContext(LocationDataContext);
}

function filterLocations(tree, level, parentValue, grandparentValue) {
  if (!tree || !tree.Rwanda) return [];

  const country = tree.Rwanda;

  switch (level) {
    case "provinces":
      return country.provinces || [];

    case "districts": {
      if (!parentValue) return [];
      const prov = (country.provinces || []).find(p =>
        p.name === parentValue ||
        p.key === parentValue ||
        p.translations?.en === parentValue ||
        p.translations?.kn === parentValue ||
        p.translations?.fr === parentValue
      );
      return prov?.districts || [];
    }

    case "sectors": {
      if (!parentValue) return [];
      for (const prov of (country.provinces || [])) {
        const dist = (prov.districts || []).find(d => d.name === parentValue || d.key === parentValue);
        if (dist) return dist.sectors || [];
      }
      return [];
    }

    case "cells": {
      if (!parentValue) return [];
      for (const prov of (country.provinces || [])) {
        for (const dist of (prov.districts || [])) {
          const sec = (dist.sectors || []).find(s => s.name === parentValue || s.key === parentValue);
          if (sec) return sec.cells || [];
        }
      }
      return [];
    }

    case "villages": {
      if (!parentValue) return [];
      for (const prov of (country.provinces || [])) {
        for (const dist of (prov.districts || [])) {
          for (const sec of (dist.sectors || [])) {
            const cell = (sec.cells || []).find(c => c.name === parentValue || c.key === parentValue);
            if (cell) return cell.villages || [];
          }
        }
      }
      return [];
    }

    default:
      return [];
  }
}

function getProvinceDisplayName(province, language) {
  if (!province) return "";
  if (province.translations?.[language]) {
    return province.translations[language];
  }
  if (province.translations?.en) {
    return province.translations.en;
  }
  return province.name || province.key || "";
}

function LoadingSpinner({ size = "sm" }) {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className={`inline-block ${sizeClass} animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]`} role="status">
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
    </div>
  );
}

function RetryButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-none border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      Retry
    </button>
  );
}

function CascadingSelectControl({ label, helpText, mandatory, value, onChange, disabled, options, loading, language, error, validMessage, translate, showRetry, onRetry, failed, isProvince }) {
  if (failed) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <label className="cok-auth-label" title={helpText || undefined}>
            {label}
            {mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
          </label>
          <RetryButton onClick={onRetry} disabled={loading} />
        </div>
        <input
          type="text"
          className="cok-auth-input w-full py-3"
          value={value || ""}
          onChange={(event) => onChange && onChange(event.target.value)}
          disabled={disabled}
          placeholder={translate("DCS_RENDERER_SELECT_PLACEHOLDER")}
        />
        <p className="mt-1 text-xs text-amber-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Using text input. Locations could not be loaded.
        </p>
        {error && (
          <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <label className="cok-auth-label" title={helpText || undefined}>
          {label}
          {mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
        </label>
        {loading && <LoadingSpinner size="sm" />}
        {showRetry && !loading && (
          <RetryButton onClick={onRetry} disabled={loading} />
        )}
      </div>
      <select
        className="cok-auth-input w-full py-3"
        value={value || ""}
        disabled={disabled || loading}
        onChange={(event) => onChange && onChange(event.target.value)}
        title={helpText || undefined}
      >
        <option value="" disabled>
          {loading ? translate("DCS_FIELD_OPTIONS_LOADING") : translate("DCS_RENDERER_SELECT_PLACEHOLDER")}
        </option>
        {options.map((option, index) => (
          <option key={option.key || option.id || index} value={option.key || option.value || option.name}>
            {isProvince ? getProvinceDisplayName(option, language) : (option.label ? get_field_text(option.label, language) : (option.name || option))}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && value && validMessage && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {validMessage}
        </p>
      )}
    </div>
  );
}

export default function CascadingSelectField({ field, language, mode, value, onChange, error, allValues, ruleValidMessage, resolveFieldOptions }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));

  const data_source = field.data_source;
  const is_api_sourced = !!data_source && data_source.type === "api";

  const { locationTree, loading: treeLoading, failed: treeFailed, retry: treeRetry } = useLocationData();

  const api_level = data_source?.level || "provinces";
  const parent_field_id = field.parent_field_id;
  const parent_value = parent_field_id ? trimmed_lookup(allValues, parent_field_id) : undefined;

  const filteredOptions = is_api_sourced && locationTree
    ? filterLocations(locationTree, api_level, parent_value)
    : [];

  const isLoading = is_api_sourced && treeLoading;
  const hasFailed = is_api_sourced && treeFailed;

  if (is_api_sourced && !is_builder) {
    if (parent_field_id && !parent_value) {
      return null;
    }

    return (
      <CascadingSelectControl
        label={label}
        helpText={help_text}
        mandatory={field.mandatory}
        value={value}
        onChange={onChange}
        disabled={is_builder}
        options={filteredOptions}
        loading={isLoading}
        language={language}
        error={error}
        validMessage={valid_message}
        translate={translate}
        showRetry={true}
        onRetry={treeRetry}
        failed={hasFailed}
        isProvince={api_level === "provinces"}
      />
    );
  }

  const is_lazy = !!field.lazy_options && !is_builder;
  const lazy_parent_value = is_lazy && field.parent_field_id ? trimmed_lookup(allValues, field.parent_field_id) : undefined;
  const lazy_parent_unanswered = is_lazy && field.parent_field_id ? !has_real_answer(lazy_parent_value) : false;
  const lazy_fetch_key = is_lazy ? (field.parent_field_id ? String(lazy_parent_value) : "__flat__") : null;

  const lazy_state = useLazyFieldOptions(is_lazy && !lazy_parent_unanswered, lazy_fetch_key, () =>
    resolveFieldOptions ? resolveFieldOptions(field, field.parent_field_id ? lazy_parent_value : undefined) : Promise.resolve([]),
  );

  if (is_lazy) {
    if (lazy_parent_unanswered) return null;
    return (
      <CascadingSelectControl
        label={label}
        helpText={help_text}
        mandatory={field.mandatory}
        value={value}
        onChange={onChange}
        disabled={is_builder}
        options={lazy_state.options}
        loading={lazy_state.loading}
        language={language}
        error={error}
        validMessage={valid_message}
        translate={translate}
        showRetry={false}
        onRetry={() => {}}
        failed={false}
        isProvince={false}
      />
    );
  }

  const { visible_options, parent_unanswered } = get_parent_linked_options_state(field, allValues, is_builder);

  if (parent_unanswered) return null;

  return (
    <CascadingSelectControl
      label={label}
      helpText={help_text}
      mandatory={field.mandatory}
      value={value}
      onChange={onChange}
      disabled={is_builder}
      options={visible_options}
      loading={false}
      language={language}
      error={error}
      validMessage={valid_message}
      translate={translate}
      showRetry={false}
      onRetry={() => {}}
      failed={false}
      isProvince={false}
    />
  );
}

export { filterLocations, getProvinceDisplayName };
