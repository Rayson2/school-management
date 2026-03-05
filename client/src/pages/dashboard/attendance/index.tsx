
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type AttendanceConfig = {
  id: string;
  schoolLatitude: number | null;
  schoolLongitude: number | null;
  allowedRadiusMeters: number;
  autoDisableMinutes: number;
  isFeatureEnabled: boolean;
  enabledAt: string | null;
  activeUntil: string | null;
  isFutureScheduleEnabled: boolean;
};

type AttendanceSchedule = {
  id: string;
  action: "on" | "off";
  triggerAt: string;
  note: string | null;
};

declare global {
  type GoogleMapClickEvent = {
    latLng?: { lat: () => number; lng: () => number };
  };

  type GoogleMapsRuntime = {
    maps?: {
      Map: new (
        element: HTMLElement,
        options: { center: { lat: number; lng: number }; zoom: number },
      ) => {
        addListener: (eventName: string, handler: (event: GoogleMapClickEvent) => void) => void;
      };
      Marker: new (options: {
        map: unknown;
        position: { lat: number; lng: number };
      }) => { setPosition: (position: { lat: number; lng: number }) => void };
    };
  };

  interface Window {
    google?: GoogleMapsRuntime;
  }
}

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "N/A";

const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default function AttendancePage() {
  const userRoles = useUserStore((state) => state.user?.roles ?? []);
  const isAdmin = userRoles.includes("admin");

  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [schoolLatitude, setSchoolLatitude] = useState("");
  const [schoolLongitude, setSchoolLongitude] = useState("");
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState("150");
  const [autoDisableMinutes, setAutoDisableMinutes] = useState("60");
  const [isFutureScheduleEnabled, setIsFutureScheduleEnabled] = useState(true);

  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [scheduleAction, setScheduleAction] = useState<"on" | "off">("on");
  const [scheduleStartDate, setScheduleStartDate] = useState(todayIST());
  const [scheduleEndDate, setScheduleEndDate] = useState(todayIST());
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<{ setPosition: (position: { lat: number; lng: number }) => void } | null>(null);
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const activeStatusText = useMemo(() => {
    if (!config?.isFeatureEnabled) return "Disabled";
    if (!config.activeUntil) return "Enabled";
    return `Enabled until ${formatDateTime(config.activeUntil)}`;
  }, [config]);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const response = await fetch("/api/attendance/config", { credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load config");
      const loadedConfig = result.data as AttendanceConfig;
      setConfig(loadedConfig);
      setSchoolLatitude(loadedConfig.schoolLatitude === null ? "" : String(loadedConfig.schoolLatitude));
      setSchoolLongitude(loadedConfig.schoolLongitude === null ? "" : String(loadedConfig.schoolLongitude));
      setAllowedRadiusMeters(String(loadedConfig.allowedRadiusMeters));
      setAutoDisableMinutes(String(loadedConfig.autoDisableMinutes));
      setIsFutureScheduleEnabled(loadedConfig.isFutureScheduleEnabled);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance config");
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadSchedules = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch("/api/attendance/schedules", { credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load schedules");
      setSchedules(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load schedules");
    }
  };

  useEffect(() => {
    loadConfig();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (!isAdmin || !mapsApiKey || window.google?.maps) return;
    const scriptId = "google-maps-attendance-script";
    if (document.getElementById(scriptId)) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}`;
    script.onerror = () => toast.error("Failed to load Google Maps");
    document.head.appendChild(script);
  }, [isAdmin, mapsApiKey]);

  useEffect(() => {
    if (!isAdmin || !mapsApiKey || !mapRef.current || !window.google?.maps) return;

    const lat = Number(schoolLatitude || config?.schoolLatitude || 20.5937);
    const lng = Number(schoolLongitude || config?.schoolLongitude || 78.9629);
    const center = { lat, lng };

    const map = new window.google.maps.Map(mapRef.current, { center, zoom: 15 });
    markerRef.current = new window.google.maps.Marker({ map, position: center });

    map.addListener("click", (event: GoogleMapClickEvent) => {
      const clickedLat = event.latLng?.lat();
      const clickedLng = event.latLng?.lng();
      if (typeof clickedLat !== "number" || typeof clickedLng !== "number") return;
      markerRef.current?.setPosition({ lat: clickedLat, lng: clickedLng });
      setSchoolLatitude(clickedLat.toFixed(6));
      setSchoolLongitude(clickedLng.toFixed(6));
    });
  }, [isAdmin, mapsApiKey, schoolLatitude, schoolLongitude, config?.schoolLatitude, config?.schoolLongitude]);

  const handleSaveConfig = async () => {
    const lat = Number(schoolLatitude);
    const lng = Number(schoolLongitude);
    const radius = Number(allowedRadiusMeters);
    const autoDisable = Number(autoDisableMinutes);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return toast.error("Please provide valid school latitude and longitude");
    if (!Number.isInteger(radius) || radius < 20 || radius > 5000) return toast.error("Allowed radius must be between 20 and 5000 meters");
    if (!Number.isInteger(autoDisable) || autoDisable < 0 || autoDisable > 1440) return toast.error("Auto disable minutes must be between 0 and 1440");

    setSavingConfig(true);
    try {
      const response = await fetch("/api/attendance/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolLatitude: lat,
          schoolLongitude: lng,
          allowedRadiusMeters: radius,
          autoDisableMinutes: autoDisable,
          isFutureScheduleEnabled,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to save attendance config");
      toast.success("Attendance configuration saved");
      await loadConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save attendance config");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleFeature = async (enabled: boolean) => {
    try {
      const response = await fetch("/api/attendance/feature-toggle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to toggle attendance feature");
      toast.success(result.message || "Attendance feature updated");
      await loadConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle attendance feature");
    }
  };

  const handleCreateSchedule = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleEndDate)) {
      return toast.error("Please provide valid start and end dates");
    }
    if (scheduleEndDate < scheduleStartDate) {
      return toast.error("End date must be after or equal to start date");
    }
    if (!/^\d{2}:\d{2}$/.test(scheduleTime)) {
      return toast.error("Please provide valid time");
    }

    setScheduling(true);
    try {
      const response = await fetch("/api/attendance/schedules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: scheduleAction,
          startDate: scheduleStartDate,
          endDate: scheduleEndDate,
          time: scheduleTime,
          note: scheduleNote.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to create schedule");
      toast.success("Schedule created");
      setScheduleNote("");
      await loadSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setScheduling(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setDeletingScheduleId(scheduleId);
    try {
      const response = await fetch(`/api/attendance/schedules/${scheduleId}`, { method: "DELETE", credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to delete schedule");
      toast.success("Schedule deleted");
      await loadSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete schedule");
    } finally {
      setDeletingScheduleId(null);
    }
  };

  return (
    <DashboardLayout title="Attendance">
      <div className="space-y-6">
        {config && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Feature Status</CardTitle>
              <CardDescription>
                <span
                  className={
                    config.isFeatureEnabled
                      ? "inline-flex rounded px-2 py-1 text-green-800 bg-green-100 font-medium"
                      : "inline-flex rounded px-2 py-1 text-red-800 bg-red-100 font-medium"
                  }
                >
                  {config.isFeatureEnabled ? "Enabled" : "Disabled"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Radius: {config.allowedRadiusMeters} meters | {activeStatusText}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3">
          {/* attendance manual */}
          <h1 className="text-2xl font-bold">Attendance</h1> 
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/dashboard/attendance/records">Open Records Page</Link>
            </Button>
            <Button type="button" variant="outline" onClick={loadConfig} disabled={loadingConfig}>
              {loadingConfig ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {isAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>School Geofence Setup</CardTitle>
                <CardDescription>Pick school location from Google Maps and set allowed radius.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="radius">Allowed Radius (meters)</Label>
                    <Input id="radius" type="number" min={20} max={5000} value={allowedRadiusMeters} onChange={(e) => setAllowedRadiusMeters(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auto-disable">Auto Disable Minutes (0 = no auto disable)</Label>
                    <Input id="auto-disable" type="number" min={0} max={1440} value={autoDisableMinutes} onChange={(e) => setAutoDisableMinutes(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input id="latitude" value={schoolLatitude} onChange={(e) => setSchoolLatitude(e.target.value)} placeholder="e.g. 22.572645" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input id="longitude" value={schoolLongitude} onChange={(e) => setSchoolLongitude(e.target.value)} placeholder="e.g. 88.363892" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input id="future-schedules" type="checkbox" checked={isFutureScheduleEnabled} onChange={(e) => setIsFutureScheduleEnabled(e.target.checked)} />
                  <Label htmlFor="future-schedules">Enable future attendance schedules</Label>
                </div>

                {mapsApiKey ? <div className="overflow-hidden rounded-md border"><div ref={mapRef} className="h-72 w-full" /></div> : <p className="text-sm text-muted-foreground">Add `VITE_GOOGLE_MAPS_API_KEY` in frontend env to pick location by clicking map.</p>}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSaveConfig} disabled={savingConfig}>{savingConfig ? "Saving..." : "Save Configuration"}</Button>
                  <Button type="button" variant="outline" onClick={() => handleToggleFeature(true)} disabled={config?.isFeatureEnabled}>Turn ON</Button>
                  <Button type="button" variant="outline" onClick={() => handleToggleFeature(false)} disabled={!config?.isFeatureEnabled}>Turn OFF</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Future Attendance Automation</CardTitle>
                <CardDescription>Schedule future ON/OFF between dates with a fixed daily time.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-action">Action</Label>
                    <select id="schedule-action" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={scheduleAction} onChange={(e) => setScheduleAction(e.target.value as "on" | "off")}>
                      <option value="on">Turn ON</option>
                      <option value="off">Turn OFF</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-start">Start Date</Label>
                    <Input id="schedule-start" type="date" value={scheduleStartDate} onChange={(e) => setScheduleStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-end">End Date</Label>
                    <Input id="schedule-end" type="date" value={scheduleEndDate} onChange={(e) => setScheduleEndDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">Time</Label>
                    <Input id="schedule-time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-note">Note (Optional)</Label>
                    <Input id="schedule-note" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} />
                  </div>
                </div>

                <Button type="button" onClick={handleCreateSchedule} disabled={scheduling}>{scheduling ? "Scheduling..." : "Create Schedule"}</Button>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Trigger Time</TableHead><TableHead>Note</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {schedules.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No future schedules.</TableCell></TableRow>
                      ) : (
                        schedules.map((schedule) => (
                          <TableRow key={schedule.id}>
                            <TableCell className="uppercase">{schedule.action}</TableCell>
                            <TableCell>{formatDateTime(schedule.triggerAt)}</TableCell>
                            <TableCell>{schedule.note || "-"}</TableCell>
                            <TableCell>
                              <Button type="button" size="sm" variant="destructive" disabled={deletingScheduleId === schedule.id} onClick={() => handleDeleteSchedule(schedule.id)}>
                                {deletingScheduleId === schedule.id ? "Deleting..." : "Delete"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
