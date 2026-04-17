'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import apiClient, { type ClaimDocumentPayload } from '@/lib/apiClient';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { syncNow } from '@/lib/locationSync';
import type { TriggerType } from '@/types';

const TRIGGER_TYPES: Array<{
  value: TriggerType;
  label: string;
  code: string;
  threshold: string;
}> = [
    { value: 'rainfall', label: 'Heavy Rainfall', code: 'RF', threshold: '50mm+' },
    { value: 'vehicle_accident', label: 'Vehicle Accident', code: 'AC', threshold: 'Document verified' },
    { value: 'platform_outage', label: 'Platform Outage', code: 'PO', threshold: '4 hours+' },
    { value: 'hospitalization', label: 'Hospitalization', code: 'HS', threshold: 'Document verified' },
    { value: 'traffic_congestion', label: 'Traffic Congestion', code: 'TC', threshold: '45 minutes+' },
  ];

type UploadedDocument = ClaimDocumentPayload & {
  id: string;
  file_name: string;
  size: number;
};

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      if (!base64) {
        reject(new Error(`Could not process ${file.name}`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function triggerGuidance(triggerType: TriggerType) {
  switch (triggerType) {
    case 'rainfall':
      return {
        title: 'Rainfall is checked automatically',
        body: 'WorkShield will verify rainfall using the weather API for your location and the event time you provide. This supports both ongoing rain and rain that happened earlier.',
      };
    case 'platform_outage':
      return {
        title: 'Choose the outage window',
        body: 'Pick the time range when the platform was down. The backend will compare that window against the platform status page and your recent shift pings.',
      };
    case 'vehicle_accident':
      return {
        title: 'Upload accident proof',
        body: 'Add FIR copies, repair evidence, or vehicle photos. Your severity input is only a claim hint for the document verifier, not the payout trigger itself.',
      };
    case 'traffic_congestion':
      return {
        title: 'Choose the congestion window',
        body: 'Pick the time range when traffic delayed your route. WorkShield will verify your delay from tracked movement and traffic baseline data instead of trusting a manual estimate.',
      };
    case 'hospitalization':
      return {
        title: 'Upload hospital proof',
        body: 'Add discharge summaries, bills, or prescriptions. Claimed admission days help the verifier cross-check your documents.',
      };
    default:
      return { title: '', body: '' };
  }
}

export default function NewClaimPage() {
  const router = useRouter();
  const { isTracking, syncStatus, syncDetail, hasPermission, liveCoords } = useLocationTracking();
  const [trafficPingCount, setTrafficPingCount] = useState<number | null>(null);
  const [checkingTrafficWindow, setCheckingTrafficWindow] = useState(false);
  const [form, setForm] = useState({
    policyId: '',
    triggerType: 'rainfall' as TriggerType,
    description: '',
    claimedSeverity: '1',
    claimedDays: '1',
    rainfallMode: 'now',
    rainfallObservedAt: toLocalDateTimeValue(new Date()),
    outageStart: toLocalDateTimeValue(new Date(Date.now() - 4 * 60 * 60 * 1000)),
    outageEnd: toLocalDateTimeValue(new Date()),
  });
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const query = new URLSearchParams(window.location.search);
    const policyIdFromQuery = query.get('policyId');
    if (policyIdFromQuery && !form.policyId) {
      setForm((prev) => ({ ...prev, policyId: policyIdFromQuery }));
    }
  }, [form.policyId]);

  const currentTrigger = TRIGGER_TYPES.find((trigger) => trigger.value === form.triggerType)!;
  const guidance = triggerGuidance(form.triggerType);
  const needsDocuments = form.triggerType === 'vehicle_accident' || form.triggerType === 'hospitalization';
  const needsTimedWindow = form.triggerType === 'platform_outage' || form.triggerType === 'traffic_congestion';
  const needsLocationForVerification = form.triggerType === 'rainfall' || form.triggerType === 'traffic_congestion';
  const trafficWindowStartIso = form.triggerType === 'traffic_congestion' ? toIsoOrNull(form.outageStart) : null;
  const trafficWindowEndIso = form.triggerType === 'traffic_congestion' ? toIsoOrNull(form.outageEnd) : null;

  useEffect(() => {
    let cancelled = false;

    async function checkTrafficWindow() {
      if (form.triggerType !== 'traffic_congestion' || !trafficWindowStartIso || !trafficWindowEndIso) {
        setTrafficPingCount(null);
        setCheckingTrafficWindow(false);
        return;
      }

      if (new Date(trafficWindowEndIso) <= new Date(trafficWindowStartIso)) {
        setTrafficPingCount(null);
        setCheckingTrafficWindow(false);
        return;
      }

      setCheckingTrafficWindow(true);
      try {
        const result = await apiClient.getLocationPingCount(trafficWindowStartIso, trafficWindowEndIso);
        if (!cancelled) {
          setTrafficPingCount(result.pingCount);
        }
      } catch {
        if (!cancelled) {
          setTrafficPingCount(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingTrafficWindow(false);
        }
      }
    }

    void checkTrafficWindow();

    return () => {
      cancelled = true;
    };
  }, [form.triggerType, trafficWindowStartIso, trafficWindowEndIso]);

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextCount = documents.length + files.length;
    if (nextCount > 5) {
      toast.error('You can upload up to 5 documents per claim');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => ({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          file_name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          content_base64: await readFileAsBase64(file),
        })),
      );

      setDocuments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process selected files');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.policyId.trim()) {
      toast.error('Policy ID is required');
      return;
    }

    if (needsDocuments && documents.length === 0) {
      toast.error('Please upload at least one supporting document');
      return;
    }

    let triggerValue: number | undefined;
    if (form.triggerType === 'vehicle_accident') {
      triggerValue = Number(form.claimedSeverity);
      if (!Number.isFinite(triggerValue) || triggerValue < 1 || triggerValue > 3) {
        toast.error('Accident severity must be between 1 and 3');
        return;
      }
    }
    if (form.triggerType === 'hospitalization') {
      triggerValue = Number(form.claimedDays);
      if (!Number.isFinite(triggerValue) || triggerValue < 1) {
        toast.error('Admission days must be at least 1');
        return;
      }
    }

    const pendingTimeWindow = needsTimedWindow
      ? {
        start: toIsoOrNull(form.outageStart),
        end: toIsoOrNull(form.outageEnd),
      }
      : undefined;

    if (needsTimedWindow && (!pendingTimeWindow?.start || !pendingTimeWindow?.end)) {
      toast.error('Please choose a valid start and end time');
      return;
    }

    const timeWindow = pendingTimeWindow?.start && pendingTimeWindow?.end
      ? { start: pendingTimeWindow.start, end: pendingTimeWindow.end }
      : undefined;

    if (needsTimedWindow && timeWindow && new Date(timeWindow.end) <= new Date(timeWindow.start)) {
      toast.error('End time must be after the start time');
      return;
    }

    if (needsLocationForVerification && hasPermission === false) {
      toast.error('Rainfall claims need location access so we can verify the event');
      return;
    }

    setSubmitting(true);
    try {
      if (hasPermission !== false) {
        await syncNow();
      }

      if (form.triggerType === 'traffic_congestion') {
        if (!timeWindow) {
          throw new Error('Please choose a valid congestion window');
        }

        const pingCheck = await apiClient.getLocationPingCount(timeWindow.start, timeWindow.end);
        setTrafficPingCount(pingCheck.pingCount);

        if (pingCheck.pingCount < 2) {
          toast.error('Traffic claims need at least 2 synced location pings in the selected window');
          return;
        }
      }

      await apiClient.createClaim({
        policyId: form.policyId.trim(),
        triggerType: form.triggerType,
        triggerValue,
        documents: needsDocuments ? documents.map(({ content_base64, mime_type, file_name }) => ({
          content_base64,
          mime_type,
          file_name,
        })) : undefined,
        timeWindow: needsTimedWindow ? timeWindow : undefined,
        weatherLookup: form.triggerType === 'rainfall' && liveCoords
          ? {
            latitude: liveCoords.lat,
            longitude: liveCoords.lng,
            observedAt: form.rainfallMode === 'now'
              ? new Date().toISOString()
              : toIsoOrNull(form.rainfallObservedAt) || undefined,
          }
          : undefined,
      });

      toast.success('Claim submitted. Verification is now running.');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to file claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <span className="finance-mono text-xs">BACK</span>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Claim intake desk</p>
            <h1 className="font-semibold text-slate-900">File New Claim</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:grid-cols-[1fr_0.38fr]">
        <section className="space-y-5">
          <Card className="finance-hero border-0 animate-soft-rise">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Verified claim workflow</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Submit the event context once and let the backend verify it from trusted signals
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <StepChip title="01 Context capture" text="Choose the claim trigger and attach the right evidence for that event type." />
                <StepChip title="02 Source verification" text="Weather, status-page, GPS, and document checks replace self-reported trigger values." />
                <StepChip title="03 Relief routing" text="The claim moves into automated review or manual review with clearer evidence trails." />
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Card className="finance-card border-0">
              <CardContent className="space-y-3 p-6">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Policy reference</label>
                  <p className="mb-2 text-xs text-slate-500">Use the policy id or policy number from your protection ledger.</p>
                  <Input
                    placeholder="Example: WSP-2026-00125"
                    value={form.policyId}
                    onChange={(event) => setForm((prev) => ({ ...prev, policyId: event.target.value }))}
                    required
                    className="h-11 finance-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="finance-card border-0">
              <CardContent className="p-6">
                <label className="mb-3 block text-sm font-semibold text-slate-900">Trigger category</label>
                <div className="grid grid-cols-2 gap-3">
                  {TRIGGER_TYPES.map((trigger) => (
                    <button
                      key={trigger.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, triggerType: trigger.value }))}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${form.triggerType === trigger.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                      <p className="finance-mono text-xs uppercase tracking-[0.16em] opacity-80">{trigger.code}</p>
                      <p className={`mt-1 text-sm font-semibold ${form.triggerType === trigger.value ? 'text-white' : 'text-slate-900'}`}>
                        {trigger.label}
                      </p>
                      <p className={`mt-1 text-xs ${form.triggerType === trigger.value ? 'text-slate-300' : 'text-slate-500'}`}>
                        Threshold: {trigger.threshold}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="finance-card border-0">
              <CardContent className="space-y-4 p-6">
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-sky-700">{guidance.title}</p>
                  <p className="mt-1 text-sm text-sky-900">{guidance.body}</p>
                </div>

                {needsLocationForVerification ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Live location readiness</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {form.triggerType === 'traffic_congestion'
                            ? 'Traffic claims use synced route pings across your selected window. Keep location access on and pick the delay window carefully.'
                            : 'Rainfall claims use your current location plus the rain event timing you choose below.'}
                        </p>
                      </div>
                      {liveCoords ? (
                        <p className="finance-mono text-xs text-slate-500">
                          {liveCoords.lat.toFixed(4)}, {liveCoords.lng.toFixed(4)}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Permission: <b>{hasPermission === null ? 'Checking' : hasPermission ? 'Allowed' : 'Denied'}</b></span>
                      <span>Tracking: <b>{isTracking ? 'Active' : 'Inactive'}</b></span>
                      <span>Sync: <b>{syncStatus}</b></span>
                    </div>
                    {syncDetail ? <p className="mt-2 text-xs text-slate-500">{syncDetail}</p> : null}
                    {form.triggerType === 'traffic_congestion' ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {checkingTrafficWindow
                          ? 'Checking synced pings for the selected congestion window...'
                          : trafficPingCount === null
                            ? 'Choose a valid congestion window to check route history.'
                            : `${trafficPingCount} synced location ping(s) found in the selected window.`}
                      </p>
                    ) : null}
                    {form.triggerType === 'traffic_congestion' && trafficPingCount !== null && trafficPingCount < 2 ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Pick a window with at least 2 synced pings before submitting this traffic claim.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {form.triggerType === 'vehicle_accident' ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-900">Claimed accident severity</label>
                    <p className="mb-2 text-xs text-slate-500">This helps the document verifier compare your photos and reports against the claim.</p>
                    <Input
                      type="number"
                      min={1}
                      max={3}
                      step={1}
                      value={form.claimedSeverity}
                      onChange={(event) => setForm((prev) => ({ ...prev, claimedSeverity: event.target.value }))}
                      required
                      className="h-11"
                    />
                  </div>
                ) : null}

                {form.triggerType === 'hospitalization' ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-900">Claimed admission days</label>
                    <p className="mb-2 text-xs text-slate-500">Use the number of days you were admitted so the backend can cross-check hospital records.</p>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={form.claimedDays}
                      onChange={(event) => setForm((prev) => ({ ...prev, claimedDays: event.target.value }))}
                      required
                      className="h-11"
                    />
                  </div>
                ) : null}

                {form.triggerType === 'rainfall' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">Rain event timing</label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, rainfallMode: 'now', rainfallObservedAt: toLocalDateTimeValue(new Date()) }))}
                          className={`rounded-xl border-2 p-4 text-left transition-all ${form.rainfallMode === 'now'
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                          <p className="text-sm font-semibold">Happening now</p>
                          <p className={`mt-1 text-xs ${form.rainfallMode === 'now' ? 'text-slate-300' : 'text-slate-500'}`}>
                            Use the current time for the weather lookup.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, rainfallMode: 'past' }))}
                          className={`rounded-xl border-2 p-4 text-left transition-all ${form.rainfallMode === 'past'
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                          <p className="text-sm font-semibold">Happened earlier</p>
                          <p className={`mt-1 text-xs ${form.rainfallMode === 'past' ? 'text-slate-300' : 'text-slate-500'}`}>
                            Pick when the rain event happened.
                          </p>
                        </button>
                      </div>
                    </div>

                    {form.rainfallMode === 'past' ? (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-900">Rain event date and time</label>
                        <p className="mb-2 text-xs text-slate-500">The backend will fetch rainfall for this event time and your location before checking the threshold.</p>
                        <Input
                          type="datetime-local"
                          value={form.rainfallObservedAt}
                          onChange={(event) => setForm((prev) => ({ ...prev, rainfallObservedAt: event.target.value }))}
                          required
                          className="h-11"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {needsTimedWindow ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">
                        {form.triggerType === 'traffic_congestion' ? 'Congestion start time' : 'Outage start time'}
                      </label>
                      <Input
                        type="datetime-local"
                        value={form.outageStart}
                        onChange={(event) => setForm((prev) => ({ ...prev, outageStart: event.target.value }))}
                        required
                        className="h-11"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">
                        {form.triggerType === 'traffic_congestion' ? 'Congestion end time' : 'Outage end time'}
                      </label>
                      <Input
                        type="datetime-local"
                        value={form.outageEnd}
                        onChange={(event) => setForm((prev) => ({ ...prev, outageEnd: event.target.value }))}
                        required
                        className="h-11"
                      />
                    </div>
                  </div>
                ) : null}

                {needsDocuments ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">Supporting documents</label>
                      <p className="mb-2 text-xs text-slate-500">Upload JPEG, PNG, WEBP, or PDF files. Maximum 5 files and 10 MB each.</p>
                      <Input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        multiple
                        onChange={handleFilesSelected}
                        disabled={uploading}
                        className="h-11 cursor-pointer"
                      />
                    </div>

                    {documents.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {documents.map((document) => (
                          <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{document.file_name}</p>
                              <p className="text-xs text-slate-500">
                                {document.mime_type} · {(document.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDocument(document.id)}
                              className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-900"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Separator />

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Supporting notes</label>
                  <Textarea
                    placeholder="Optional: event timeline, reference numbers, or field notes for your own record"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Outcome preview</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Verified evidence can move faster. If the system finds missing GPS history, unclear documents, or unavailable source data, the claim will route into review instead of trusting manual values.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" disabled={submitting || uploading} className="h-12 w-full bg-slate-900 text-white hover:bg-slate-800">
              {submitting ? 'Submitting claim...' : uploading ? 'Preparing files...' : 'Submit claim'}
            </Button>
          </form>
        </section>

        <aside className="space-y-4">
          <Card className="finance-card border-0">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Intake checklist</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>1. Confirm your active policy reference</li>
                <li>2. Pick the trigger type that matches the event</li>
                <li>3. Add the required context: a time window or verified documents</li>
                <li>4. Keep location access on for rainfall and traffic verification</li>
                <li>5. Submit once and let verification run against trusted sources</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="finance-card border-0">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Expected processing</p>
              <p className="mt-2 text-sm text-slate-700">
                Rainfall, outage, and congestion claims use authoritative data sources. Accident and hospitalization claims can start in manual review if the document verifier finds issues or the AI service is unavailable.
              </p>
              <p className="mt-2 finance-mono text-xs text-slate-500">Settlement states: pending, approved, soft_flag, hard_block, paid</p>
            </CardContent>
          </Card>

          <Card className="finance-card border-0">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current trigger</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{currentTrigger.label}</p>
              <p className="mt-1 text-sm text-slate-600">Policy threshold: {currentTrigger.threshold}</p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function StepChip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-200 sm:text-sm">{text}</p>
    </div>
  );
}
