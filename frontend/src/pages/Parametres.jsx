import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import api, { resolveApiErrorMessage, unwrapApiData } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Cpu,
  MapPin,
  Save,
  ShieldAlert,
  Users,
  Wifi,
  Zap,
  Compass,
} from "lucide-react";

function isRtlLang(language) {
  return language === "ar";
}

function badgeClassForPpm(ppm, { limitGood, limitWarning, limitCritical }) {
  const g = Number(limitGood);
  const w = Number(limitWarning);
  const c = Number(limitCritical);
  if (!Number.isFinite(ppm)) return "status-badge";
  if (ppm < g) return "status-badge status-badge-good";
  if (ppm < w) return "status-badge status-badge-warning";
  return "status-badge status-badge-critical";
}

function Field({ label, children }) {
  return (
    <div>
      <label className="ui-label">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="ui-switch"
      data-checked={checked ? "true" : "false"}
      aria-pressed={checked}
    >
      <span className="ui-switch__dot" />
    </button>
  );
}

function SwitchRow({ label, checked, onChange, disabled }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">{label}</div>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

export default function Parametres() {
  const { user, hasRole } = useAuth();
  const { t, i18n } = useTranslation();

  const role = String(user?.role || "").toUpperCase();
  const isAdmin = hasRole("ADMIN");
  const isTechnician = hasRole("TECHNICIAN");
  const isClient = role === "CLIENT";

  const [tab, setTab] = useState(() => (isAdmin ? "positioning" : isTechnician ? "iot" : "notify"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Settings globaux (réutilise /settings)
  const [settings, setSettings] = useState({
    // Seuils & IA
    limitGood: 600,
    limitWarning: 1000,
    limitCritical: 1400,
    aiModel: "Random Forest",
    horizonMinutes: 30,

    // IoT & réseau
    samplingIntervalSeconds: 60,
    wifiSsid: "",
    mqttBrokerUrl: "",
    mqttTopic: "",

    // Notifications
    notifyEmail: true,
    notifyPush: true,
    notifyWebhookSlack: false,
    slackWebhookUrl: "",
    notifyWebhookDiscord: false,
    discordWebhookUrl: "",
  });

  const [sensorTest, setSensorTest] = useState({ sensorId: "", last: null, mqtt: null });

  const [users, setUsers] = useState([]);
  const [invite, setInvite] = useState({ name: "", email: "", role: "CLIENT" });

  const [positioningZones, setPositioningZones] = useState([]);
  const [positioningFixLoading, setPositioningFixLoading] = useState(false);
  const [positioningReference, setPositioningReference] = useState({ lat: null, lng: null });
  const [geofenceRadiusM, setGeofenceRadiusM] = useState(10);

  const allowedTabs = useMemo(() => {
    const out = [];
    // Onglet 1 POSITIONING: ADMIN & TECHNICIAN
    if (isAdmin || isTechnician) out.push("positioning");
    // Onglet 2 THRESHOLDS: ADMIN only
    if (isAdmin) out.push("thresholds");
    // Onglet 3 IoT: ADMIN & TECHNICIAN
    if (isAdmin || isTechnician) out.push("iot");
    // Onglet 3bis / Notifications
    out.push("notify");
    // Onglet 4 Users: ADMIN only
    if (isAdmin) out.push("users");
    return out;
  }, [isAdmin, isTechnician]);

  useEffect(() => {
    if (!allowedTabs.includes(tab)) setTab(allowedTabs[0] || "notify");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTabs.join("|")]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/settings");
        const payload = unwrapApiData(res.data);
        if (!mounted) return;
        setSettings((prev) => ({ ...prev, ...(payload || {}) }));
        setError("");
      } catch (e) {
        if (!mounted) return;
        setError(resolveApiErrorMessage(e, t("settings.errors.load_failed") || "Unable to load settings"));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (tab === "positioning") {
      (async () => {
        try {
          const res = await api.get("/positioning/positions");
          const payload = unwrapApiData(res.data);
          setPositioningZones(Array.isArray(payload) ? payload : []);
        } catch (_e) {}
      })();
    }

    if (tab === "users") {
      if (!isAdmin) return;
      (async () => {
        try {
          const res = await api.get("/users");
          const payload = unwrapApiData(res.data);
          setUsers(Array.isArray(payload) ? payload : []);
        } catch (_e) {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const save = async (patch) => {
    try {
      setSaving(true);
      const res = await api.patch("/settings", patch);
      const payload = unwrapApiData(res.data);
      setSettings((prev) => ({ ...prev, ...(payload || {}) }));
      toast.success(t("settings.common.saved") || "Saved");
    } catch (e) {
      toast.error(resolveApiErrorMessage(e, t("settings.errors.save_failed") || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const runSensorTest = async () => {
    try {
      const res = await api.get(`/settings/sensor-test?sensorId=${encodeURIComponent(sensorTest.sensorId || "")}`);
      const payload = unwrapApiData(res.data);
      setSensorTest((p) => ({
        ...p,
        last: payload?.lastReading || null,
        mqtt: payload?.mqtt || null,
      }));
      toast.success(t("settings.iot.ping_done") || "Ping done");
    } catch (e) {
      toast.error(resolveApiErrorMessage(e, t("settings.iot.ping_failed") || "Ping failed"));
    }
  };

  const inviteUser = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.post("/users/invite", invite);
      const created = unwrapApiData(res.data);
      toast.success(t("settings.users.invite_created") || "Invitation created");
      setInvite({ name: "", email: "", role: "CLIENT" });
      setUsers((prev) => [created, ...prev]);
    } catch (e) {
      toast.error(resolveApiErrorMessage(e, t("settings.users.invite_failed") || "Invite failed"));
    }
  };

  const updateUserRole = async (companyUserId, nextRole) => {
    if (!isAdmin) return;
    try {
      const res = await api.patch(`/users/${encodeURIComponent(companyUserId)}/role`, { role: nextRole });
      const updated = unwrapApiData(res.data);
      setUsers((prev) => prev.map((u) => (String(u.companyUserId) === String(companyUserId) ? updated : u)));
    } catch (_e) {}
  };

  const tabs = [
    {
      key: "positioning",
      title: t("settings.positioning.tabs.title"),
      desc: t("settings.positioning.tabs.desc"),
      icon: Compass,
      visible: isAdmin || isTechnician,
    },
    {
      key: "thresholds",
      title: t("settings.thresholds.tabs.title"),
      desc: t("settings.thresholds.tabs.desc"),
      icon: ShieldAlert,
      visible: isAdmin,
    },
    {
      key: "iot",
      title: t("settings.iot.tabs.title"),
      desc: t("settings.iot.tabs.desc"),
      icon: Cpu,
      visible: isAdmin || isTechnician,
    },
    {
      key: "notify",
      title: t("settings.notify.tabs.title"),
      desc: t("settings.notify.tabs.desc"),
      icon: Bell,
      visible: true,
    },
    {
      key: "users",
      title: t("settings.users.tabs.title"),
      desc: t("settings.users.tabs.desc"),
      icon: Users,
      visible: isAdmin,
    },
  ].filter((x) => x.visible);

  const thresholdBadges = useMemo(() => {
    return {
      good: { label: t("settings.thresholds.badges.good"), ppm: settings.limitGood },
      warning: { label: t("settings.thresholds.badges.warning"), ppm: settings.limitWarning },
      critical: { label: t("settings.thresholds.badges.critical"), ppm: settings.limitCritical },
    };
  }, [settings.limitGood, settings.limitWarning, settings.limitCritical, t]);

  const tabsContainerDir = isRtlLang(i18n.language) ? "rtl" : "ltr";

  return (
    <div dir={tabsContainerDir}>
      <AppLayout title={t("settings.title") || "Paramètres"} subtitle={t("settings.subtitle") || ""}>
        <div className="ui-vtabs">
          {/* Sidebar interne */}
          <GlassCard className="p-4 h-fit lg:sticky lg:top-[92px]">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.common.tabs") || "Tabs"}</div>
              <span className="ui-badge text-muted-foreground">{role || "—"}</span>
            </div>
            <div className="mt-3 ui-vtabs__nav">
              {tabs.map(({ key, title, desc, icon: Icon }) => (
                <button
                  key={key}
                  className="ui-vtab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="ui-vtab__title">{title}</div>
                      <div className="ui-vtab__desc">{desc}</div>
                    </div>
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Contenu */}
          <div className="grid gap-3">
            <GlassCard className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.common.profile")}</div>
                  <div className="mt-1 text-sm font-extrabold">{user?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{user?.email || "—"}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("settings.common.access")}: <span className="font-semibold text-foreground">{role}</span>
                </div>
              </div>
            </GlassCard>

            {loading && <GlassCard className="p-4 text-sm text-muted-foreground">{t("settings.common.loading")}</GlassCard>}
            {error && <GlassCard className="p-4 text-sm text-status-critical">{error}</GlassCard>}

            {!loading && !error && (
              <>
                {tab === "positioning" && (
                  <GlassCard className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <div className="ui-section-title">{t("settings.positioning.title")}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("settings.positioning.desc")}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("settings.positioning.zones_testees")}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{t("settings.positioning.recommended")}</span>
                        </div>

                        <div className="mt-3 grid gap-2">
                          {positioningZones.length === 0 ? (
                            <div className="text-xs text-muted-foreground">—</div>
                          ) : (
                            positioningZones.map((z) => (
                              <PositionZoneRow key={String(z.id)} zone={z} />
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <Field label={t("settings.positioning.gps_reference") + " · " + t("settings.positioning.latitude") }>
                            <input
                              className="ui-pill ui-pill--mono"
                              type="number"
                              readOnly
                              value={positioningReference.lat ?? ""}
                              placeholder={"—"}
                            />
                          </Field>
                          <Field label={t("settings.positioning.gps_reference") + " · " + t("settings.positioning.longitude") }>
                            <input
                              className="ui-pill ui-pill--mono"
                              type="number"
                              readOnly
                              value={positioningReference.lng ?? ""}
                              placeholder={"—"}
                            />
                          </Field>

                          <div className="lg:col-span-2">
                            <Field label={`${t("settings.positioning.geofencing")} · ${t("settings.positioning.radius_m")}: ${geofenceRadiusM}m`}>
                              <input
                                type="range"
                                min={5}
                                max={30}
                                step={1}
                                value={geofenceRadiusM}
                                onChange={(e) => setGeofenceRadiusM(Number(e.target.value))}
                                disabled
                              />
                              <div className="mt-1 text-xs text-muted-foreground">{t("settings.positioning.radius_hint")}</div>
                            </Field>
                            <div className="mt-3">
                              <button
                                type="button"
                                className="ui-ghost ui-ghost--primary w-full justify-center disabled:opacity-60"
                                disabled
                                title={t("settings.positioning.fix_position_disabled")}
                              >
                                <Save className="h-4 w-4" /> {t("settings.positioning.fix_position")}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground">
                          {t("settings.positioning.not_implemented")}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )}

                {tab === "thresholds" && (
                  <GlassCard className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        <div className="ui-section-title">{t("settings.thresholds.title")}</div>
                      </div>
                      <button
                        className="ui-ghost ui-ghost--primary"
                        disabled={!isAdmin || saving}
                        onClick={() =>
                          save({
                            limitGood: settings.limitGood,
                            limitWarning: settings.limitWarning,
                            limitCritical: settings.limitCritical,
                            aiModel: settings.aiModel,
                            horizonMinutes: settings.horizonMinutes,
                          })
                        }
                        type="button"
                      >
                        <Save className="h-4 w-4" /> {t("settings.common.save")}
                      </button>
                    </div>

                    {!isAdmin && (
                      <div className="mt-3 rounded-2xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
                        {t("settings.common.admin_only")}
                      </div>
                    )}

                    {isAdmin && (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <Field label={t("settings.thresholds.limit_good")}>
                          <input
                            className="ui-pill ui-pill--mono"
                            type="number"
                            min={350}
                            max={1200}
                            value={settings.limitGood}
                            onChange={(e) => setSettings((p) => ({ ...p, limitGood: Number(e.target.value) }))}
                          />
                          <div className={badgeClassForPpm(settings.limitGood, settings)}>{thresholdBadges.good.label}</div>
                        </Field>

                        <Field label={t("settings.thresholds.limit_warning")}>
                          <input
                            className="ui-pill ui-pill--mono"
                            type="number"
                            min={600}
                            max={2000}
                            value={settings.limitWarning}
                            onChange={(e) => setSettings((p) => ({ ...p, limitWarning: Number(e.target.value) }))}
                          />
                          <div className={badgeClassForPpm(settings.limitWarning, settings)}>{thresholdBadges.warning.label}</div>
                        </Field>

                       
