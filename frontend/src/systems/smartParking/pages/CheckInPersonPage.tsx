import React, { useState } from 'react';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import VisitorForm, { serverErrorField, validateVisitorForm } from '../../../core/components/visitor/VisitorForm';
import type { VisitorFormErrors } from '../../../core/components/visitor/VisitorForm';
import { failureOf } from '../../../core/components/visitor/visitorApi';
import type { VisitorInput } from '../../../core/components/visitor/visitorTypes';
import { emptyVisitorInput } from '../../../core/components/visitor/visitorTypes';

const NEUTRAL_LIGHT = '#F7F9FB';
const WHITE = '#FFFFFF';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const WARNING_CODES = ['ALREADY_IN_HOUSE', 'VISITOR_CONFLICT'];

const payloadOf = (input: VisitorInput) => {
  const { visitor_id, ...rest } = input;
  return visitor_id ? { ...rest, visitor_id } : rest;
};

const CheckInPersonPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const [value, setValue] = useState<VisitorInput>(emptyVisitorInput);
  const [errors, setErrors] = useState<VisitorFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const reset = () => {
    setValue(emptyVisitorInput());
    setErrors({});
    setFormKey((key) => key + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found = validateVisitorForm(value);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const response = await serviceDeliveryService.checkIn(payloadOf(value));
      if (response?.success === false) {
        showError(response.message || 'Failed to check in the visitor');
        return;
      }
      showSuccess(response?.message || 'Visitor checked in');
      reset();
    } catch (error) {
      const failure = failureOf(error);
      const key = serverErrorField(failure.field);
      if (key) {
        const next: VisitorFormErrors = {};
        next[key] = failure.message;
        setErrors(next);
      }
      if (failure.code && WARNING_CODES.includes(failure.code)) showWarning(failure.message);
      else showError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT, minHeight: '100%' }}>
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="p-4 sm:p-6 flex flex-col gap-4"
            style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}
          >
            <div>
              <h1 className="text-base font-semibold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Visitor check-in
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Type the ID number first: a registered visitor is filled in automatically and every field stays editable.
              </p>
            </div>

            <VisitorForm key={formKey} value={value} onChange={setValue} errors={errors} disabled={saving} mode="register" />

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="cok-btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Checking in...
                  </>
                ) : (
                  'Check in'
                )}
              </button>
              <button type="button" disabled={saving} onClick={reset} className="cok-btn-outlined disabled:opacity-50">
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
};

export default CheckInPersonPage;
