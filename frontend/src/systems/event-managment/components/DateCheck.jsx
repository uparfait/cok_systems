import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import SpiralLoader from './SpiralLoader';
import DateCheckForm from './sub-components/DateCheckForm';
import DateCheckResults from './sub-components/DateCheckResults';
import ErrorAlert from './sub-components/ErrorAlert';

const BASE_URL = '/cok/api/v1';

export default function DateCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [eventMode, setEventMode] = useState('');
  const [recurringType, setRecurringType] = useState('');
  const [monthlyPattern, setMonthlyPattern] = useState('specific');
  const [weeklyDays, setWeeklyDays] = useState([]);
  const [monthlyDates, setMonthlyDates] = useState('');
  const [expandedRoom, setExpandedRoom] = useState(null);
  const retryRef = useRef(false);

  const [formData, setFormData] = useState({
    startTime: '', endTime: '', eventStartTime: '', eventEndTime: '', recurringEndDate: '',
  });

  const submitRequestRef = useRef(null);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setResult(null);
    setError(null);
  };

  const toggleWeeklyDay = (day) => {
    setWeeklyDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const buildQueryParams = () => {
    const params = {
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      eventMode,
    };
    if (eventMode === 'recurring') {
      params.recurringType = recurringType;
      params.eventStartTime = formData.eventStartTime;
      params.eventEndTime = formData.eventEndTime;
      params.recurringEndDate = new Date(formData.recurringEndDate).toISOString();
      if (recurringType === 'Weekly') params.weeklyDays = weeklyDays.join(',');
      if (recurringType === 'Monthly') {
        params.monthlyPattern = monthlyPattern;
        if (monthlyPattern === 'specific' || monthlyPattern === 'mixed') params.monthlyDates = monthlyDates;
      }
    }
    return params;
  };

  const submitRequest = async (skipAutoRetry = false) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = buildQueryParams();
      const response = await axios.get(`${BASE_URL}/rooms/available`, { params });
      setResult(response.data.data || response.data);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to check room availability. Please try again.';
      setError(errMsg);
      if (!skipAutoRetry && err.response?.status >= 500 && !retryRef.current) {
        retryRef.current = true;
        setTimeout(() => { if (submitRequestRef.current) submitRequestRef.current(true); }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { submitRequestRef.current = submitRequest; });

  const handleSubmit = (e) => { e.preventDefault(); retryRef.current = false; submitRequest(false); };
  const handleRetry = () => { retryRef.current = false; submitRequest(false); };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const isValid = () => {
    if (!eventMode || !formData.startTime || !formData.endTime) return false;
    if (eventMode === 'recurring') {
      if (!formData.eventStartTime || !formData.eventEndTime || !formData.recurringEndDate) return false;
      if (recurringType === 'Weekly' && weeklyDays.length === 0) return false;
      if (recurringType === 'Monthly' && monthlyDates.trim() === '' && monthlyPattern === 'specific') return false;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 ppp-lg p-12 text-center">
            <div className="ppp-full h-8 w-8 mx-auto mb-4"><SpiralLoader /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-4">
          <p className="text-sm text-gray-500 mt-1">
            Check availability for all active rooms across any time period or recurring schedule
          </p>
        </div>

        <ErrorAlert message={error} onRetry={handleRetry} />

        <DateCheckForm
          eventMode={eventMode}
          setEventMode={setEventMode}
          formData={formData}
          handleChange={handleChange}
          recurringType={recurringType}
          setRecurringType={setRecurringType}
          monthlyPattern={monthlyPattern}
          setMonthlyPattern={setMonthlyPattern}
          weeklyDays={weeklyDays}
          toggleWeeklyDay={toggleWeeklyDay}
          monthlyDates={monthlyDates}
          setMonthlyDates={setMonthlyDates}
          handleSubmit={handleSubmit}
          isValid={isValid}
          getMinDateTime={getMinDateTime}
        />

        <DateCheckResults result={result} expandedRoom={expandedRoom} setExpandedRoom={setExpandedRoom} />
      </div>
    </div>
  );
}