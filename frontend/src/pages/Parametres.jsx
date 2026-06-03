import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Bell,
  Cpu,
  Save,
  ShieldAlert,
  Users,
  Wifi,
  Zap,
  Compass,
  ExternalLink,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import api, { resolveApiErrorMessage, unwrapApiData } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_SETTINGS = {
  limitGood: 800,
  limitWarning: 1000,
  limitCritical: 1400,
  aiModel: "standard",
  horizonMinutes: 30,
  samplingIntervalSeconds: 60,
  wifiSsid: "",
  mqttBrokerUrl: "",
  mqttTopic: "",
  notifyEmail: true,
  notifyPush: true,
  notifyWebhookSlack: false,
  slackWebhookUrl: "",
  notifyWebhookDiscord: false,
  discordWebhookUrl: "",
  companyName: "",
  factoryLocation: "",
};

const PREDICTION_MODELS = [
  { value: "standard", labelKey: "settings.thresholds.models.standard" },
  { value: "advanced", labelKey: "settings.thresholds.models.advanced" },
];

function roleLabel(t, role) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return t("settings.users.roles.ADMIN");
  if (r === "TECHNICIAN") return t("settings.users.roles.TECHNICIAN");
  return t("settings.users.roles.CLIENT");
}

function ppmBadgeClass(ppm, limits) {
  const g = Number(limits.limitGood) || 800;
  const w = Number(limits.limitWarning) || 1000;
  if (!Number.isFinite(ppm)) return "status-badge";
  if (ppm < g) return "inline-flex rounded-full border px-3 py-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  if (ppm <= w) return "inline-flex rounded-full border px-3 py-1 text-xs font-semibold text-amber-500 bg-amber-500/10 border-amber-500/30";
  return "inline-flex rounded-full border px-3 py-1 text-xs font-semibold text-rose-500 bg-rose-500/10 border-rose-500/30";
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
        <span className="text-sm">{label}</span>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, onSave, saving, saveDisabled, saveLabel }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="ui-section-title">{title}</h2>
      </div>
      {onSave && (
        <button
          type="button"
          className="ui-ghost ui-ghost--primary"
          disabled={saveDisabled || saving}
          onClick={onSave}
        >
          <Save className="h-4 w-4" /> {saveLabel}
        </button>
      )}
    </div>
  );
}

export default function Parametres() {
  const { user, hasRole } = useAuth();
  const { t, i18n } = useTranslation();

  const isAdmin = hasRole("ADMIN");
  const isTechnician = hasRole("TECHNICIAN");
  const isClient = hasRole("CLIENT") && !isAdmin && !isTechnician;

  const tabs = useMemo(() => {
    const list = [{ id: "general", icon: Bell, label: t("settings.notify.tabs.title"), desc: t("settings.notify.tabs.desc") }];
    if (isAdmin) {
      list.push({ id: "thresholds", icon: ShieldAlert, label: t("settings.thresholds.tabs.title"), desc: t("settings.thresholds.tabs.desc") });
    }
    if (isAdmin || isTechnician) {
      list.push({ id: "sensors", icon: Cpu, label: t("settings.iot.tabs.title"), desc: t("settings.iot.tabs.desc") });
      list.push({ id: "placement", icon: Compass, label: t("settings.positioning.tabs.title"), desc: t("settings.positioning.tabs.desc") });
    }
    if (isAdmin) {
      list.push({ id: "team", icon: Users, label: t("settings.users.tabs.title"), desc: t("settings.users.tabs.desc") });
    }
    return list;
  }, [isAdmin, isTechnician, t]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [sensorTest, setSensorTest] = useState({ sensorId: "", last: null, linkOk: null });
  const [positions, setPositions] = useState([]);
  const [users, setUsers] = useState([]);
  const [invite, setInvite] = useState({ name: "", email: "", role: "CLIENT" });

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "general");
    }
  }, [tabs, activeTab]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/settings");
      const data = unwrapApiData(res.data);
      setSettings((prev) => ({ ...prev, ...(data || {}) }));
    } catch (e) {
      // Non bloquant: les autres onglets doivent rester utilisables.
      setError(resolveApiErrorMessage(e, t("settings.errors.load_failed")));
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab !== "placement" || !(isAdmin || isTechnician)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/positioning/positions");
        const rows = unwrapApiData(res.data);
        if (!cancelled) setPositions(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setPositions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAdmin, isTechnician]);

  useEffect(() => {
    if (activeTab !== "team" || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/users");
        const rows = unwrapApiData(res.data);
        if (!cancelled) setUsers(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAdmin]);

  const saveSettings = async (patch) => {
    try {
      setSaving(true);
      const res = await api.patch("/settings", patch);
      const data = unwrapApiData(res.data);
      setSettings((prev) => ({ ...prev, ...(data || {}) }));
      toast.success(t("settings.common.saved"));
    } catch (e) {
      toast.error(resolveApiErrorMessage(e, t("settings.errors.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  const runSensorTest = async () => {
    try {
      const res = await api.get(`/settings/sensor-test?sensorId=${encodeURIComponent(sensorTest.sensorId || "")}`);
      const data = unwrapApiData(res.data);
      setSensorTest((p) => ({
        ...p,
        last: data?.lastReading ?? null,
        linkOk: Boolean(data?.mqtt?.connected),
      }));
      toast.success(t("settings.iot.ping_done"));
    } catch (e) {
      toast.error(resolveApiErrorMessage(e, t("settings.iot.ping_failed")));
    }
  };

  const inviteUser = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.post("/users/invite", invite);
      const created = unwrapApiData(res.data);
      setInvite({ name: "", email: "", role: "CLIENT" });
      setUsers((prev) => [created, ...prev]);
      toast.success(t("settings.users.invite_created"));
    } catch (e) {
      toast.error(resolveApiErrorMessage(e, t("settings.users.invite_failed")));
    }
  };

  const updateUserRole = async (id, role) => {
    if (!isAdmin) return;
    try {
      const res = await api.patch(`/users/${encodeURIComponent(id)}/role`, { role });
      const updated = unwrapApiData(res.data);
      setUsers((prev) => prev.map((u) => (String(u.companyUserId || u.id) === String(id) ? updated : u)));
    } catch {
      toast.error(t("settings.errors.save_failed"));
    }
  };

  const dir = i18n.language === "ar" ? "rtl" : "ltr";
  const saveLabel = t("settings.common.save");

  return (
    <div dir={dir}>
      <AppLayout title={t("settings.title")} subtitle={t("settings.subtitle")}>
        <div className="ui-vtabs">
          <GlassCard className="p-4 h-fit lg:sticky lg:top-[92px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("settings.common.tabs")}
              </span>
              <span className="ui-badge text-muted-foreground">{roleLabel(t, user?.role)}</span>
            </div>
            <nav className="mt-3 ui-vtabs__nav" aria-label={t("settings.common.tabs")}>
              {tabs.map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="ui-vtab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-start">
                      <div className="ui-vtab__title">{label}</div>
                      <div className="ui-vtab__desc">{desc}</div>
                    </div>
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                  </div>
                </button>
              ))}
            </nav>
          </GlassCard>

          <div className="grid gap-3 min-w-0">
            <GlassCard className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settings.common.profile")}
                  </p>
                  <p className="mt-1 text-sm font-extrabold">{user?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settings.common.access")}:{" "}
                  <span className="font-semibold text-foreground">{roleLabel(t, user?.role)}</span>
                </p>
              </div>
            </GlassCard>

            {loading && (
              <GlassCard className="p-4 text-sm text-muted-foreground">{t("settings.common.loading")}</GlassCard>
            )}

            {error && !loading && (
              <GlassCard className="p-4 space-y-3">
                <p className="text-sm text-status-critical">{error}</p>
                <button type="button" className="ui-ghost ui-ghost--primary" onClick={loadSettings}>
                  {t("settings.common.refresh")}
                </button>
              </GlassCard>
            )}

            {!loading && activeTab === "general" && (
              <GlassCard className="p-4 space-y-4">
                <SectionHeader
                  icon={Bell}
                  title={t("settings.notify.title")}
                  saveLabel={saveLabel}
                  saving={saving}
                  saveDisabled={isClient}
                  onSave={() =>
                    saveSettings({
                      notifyEmail: settings.notifyEmail,
                      notifyPush: settings.notifyPush,
                      notifyWebhookSlack: settings.notifyWebhookSlack,
                      slackWebhookUrl: settings.slackWebhookUrl,
                      notifyWebhookDiscord: settings.notifyWebhookDiscord,
                      discordWebhookUrl: settings.discordWebhookUrl,
                      companyName: settings.companyName,
                      factoryLocation: settings.factoryLocation,
                    })
                  }
                />
                <div className="grid gap-2">
                  <Field label="Entreprise">
                    <input
                      className="ui-pill w-full"
                      value={settings.companyName}
                      onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))}
                      disabled={isClient}
                    />
                  </Field>
                  <Field label="Localisation usine">
                    <input
                      className="ui-pill w-full"
                      value={settings.factoryLocation}
                      onChange={(e) => setSettings((s) => ({ ...s, factoryLocation: e.target.value }))}
                      disabled={isClient}
                    />
                  </Field>
                  <SwitchRow
                    label={t("settings.notify.email")}
                    checked={settings.notifyEmail}
                    onChange={(v) => setSettings((s) => ({ ...s, notifyEmail: v }))}
                    disabled={isClient}
                  />
                  <SwitchRow
                    label={t("settings.notify.push")}
                    checked={settings.notifyPush}
                    onChange={(v) => setSettings((s) => ({ ...s, notifyPush: v }))}
                    disabled={isClient}
                  />
                  <SwitchRow
                    label={t("settings.notify.slack")}
                    checked={settings.notifyWebhookSlack}
                    onChange={(v) => setSettings((s) => ({ ...s, notifyWebhookSlack: v }))}
                    disabled={isClient}
                  />
                  {settings.notifyWebhookSlack && (
                    <Field label={t("settings.notify.slack_url")}>
                      <input
                        className="ui-pill w-full"
                        value={settings.slackWebhookUrl}
                        onChange={(e) => setSettings((s) => ({ ...s, slackWebhookUrl: e.target.value }))}
                        disabled={isClient}
                      />
                    </Field>
                  )}
                  <SwitchRow
                    label={t("settings.notify.discord")}
                    checked={settings.notifyWebhookDiscord}
                    onChange={(v) => setSettings((s) => ({ ...s, notifyWebhookDiscord: v }))}
                    disabled={isClient}
                  />
                  {settings.notifyWebhookDiscord && (
                    <Field label={t("settings.notify.discord_url")}>
                      <input
                        className="ui-pill w-full"
                        value={settings.discordWebhookUrl}
                        onChange={(e) => setSettings((s) => ({ ...s, discordWebhookUrl: e.target.value }))}
                        disabled={isClient}
                      />
                    </Field>
                  )}
                </div>
              </GlassCard>
            )}

            {!loading && activeTab === "thresholds" && isAdmin && (
              <GlassCard className="p-4 space-y-4">
                <SectionHeader
                  icon={ShieldAlert}
                  title={t("settings.thresholds.title")}
                  saveLabel={saveLabel}
                  saving={saving}
                  onSave={() =>
                    saveSettings({
                      limitGood: settings.limitGood,
                      limitWarning: settings.limitWarning,
                      limitCritical: settings.limitCritical,
                      aiModel: settings.aiModel,
                      horizonMinutes: settings.horizonMinutes,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">{t("settings.thresholds.desc")}</p>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label={t("settings.thresholds.limit_good")}>
                    <input
                      className="ui-pill ui-pill--mono w-full"
                      type="number"
                      min={350}
                      max={1200}
                      value={settings.limitGood}
                      onChange={(e) => setSettings((s) => ({ ...s, limitGood: Number(e.target.value) }))}
                    />
                    <div className={ppmBadgeClass(settings.limitGood, settings)}>{t("settings.thresholds.badges.good")}</div>
                  </Field>
                  <Field label={t("settings.thresholds.limit_warning")}>
                    <input
                      className="ui-pill ui-pill--mono w-full"
                      type="number"
                      min={600}
                      max={2000}
                      value={settings.limitWarning}
                      onChange={(e) => setSettings((s) => ({ ...s, limitWarning: Number(e.target.value) }))}
                    />
                    <div className={ppmBadgeClass(settings.limitWarning, settings)}>{t("settings.thresholds.badges.warning")}</div>
                  </Field>
                  <Field label={t("settings.thresholds.limit_critical")}>
                    <input
                      className="ui-pill ui-pill--mono w-full"
                      type="number"
                      min={800}
                      max={5000}
                      value={settings.limitCritical}
                      onChange={(e) => setSettings((s) => ({ ...s, limitCritical: Number(e.target.value) }))}
                    />
                    <div className={ppmBadgeClass(settings.limitCritical, settings)}>{t("settings.thresholds.badges.critical")}</div>
                  </Field>
                  <Field label={t("settings.thresholds.model")}>
                    <select
                      className="ui-pill w-full"
                      value={settings.aiModel}
                      onChange={(e) => setSettings((s) => ({ ...s, aiModel: e.target.value }))}
                    >
                      {PREDICTION_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {t(m.labelKey)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("settings.thresholds.horizon")}>
                    <input
                      className="ui-pill ui-pill--mono w-full"
                      type="number"
                      min={5}
                      max={120}
                      value={settings.horizonMinutes}
                      onChange={(e) => setSettings((s) => ({ ...s, horizonMinutes: Number(e.target.value) }))}
                    />
                  </Field>
                </div>
              </GlassCard>
            )}

            {!loading && activeTab === "sensors" && (isAdmin || isTechnician) && (
              <GlassCard className="p-4 space-y-4">
                <SectionHeader
                  icon={Cpu}
                  title={t("settings.iot.title")}
                  saveLabel={saveLabel}
                  saving={saving}
                  onSave={() =>
                    saveSettings({
                      samplingIntervalSeconds: settings.samplingIntervalSeconds,
                      wifiSsid: settings.wifiSsid,
                      mqttBrokerUrl: settings.mqttBrokerUrl,
                      mqttTopic: settings.mqttTopic,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">{t("settings.iot.desc")}</p>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label={`${t("settings.iot.sampling")} (${t("settings.iot.sampling_s")})`}>
                    <input
                      className="ui-pill ui-pill--mono w-full"
                      type="number"
                      min={10}
                      max={300}
                      value={settings.samplingIntervalSeconds}
                      onChange={(e) => setSettings((s) => ({ ...s, samplingIntervalSeconds: Number(e.target.value) }))}
                    />
                  </Field>
                  <Field label={t("settings.iot.wifi_ssid")}>
                    <input
                      className="ui-pill w-full"
                      value={settings.wifiSsid}
                      onChange={(e) => setSettings((s) => ({ ...s, wifiSsid: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("settings.iot.mqtt_host")}>
                    <input
                      className="ui-pill w-full"
                      value={settings.mqttBrokerUrl}
                      onChange={(e) => setSettings((s) => ({ ...s, mqttBrokerUrl: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("settings.iot.mqtt_topic")}>
                    <input
                      className="ui-pill w-full"
                      value={settings.mqttTopic}
                      onChange={(e) => setSettings((s) => ({ ...s, mqttTopic: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/30 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settings.iot.diagnostics")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="ui-pill flex-1 min-w-[140px]"
                      placeholder={t("settings.iot.sensor_id_placeholder")}
                      value={sensorTest.sensorId}
                      onChange={(e) => setSensorTest((p) => ({ ...p, sensorId: e.target.value }))}
                    />
                    <button type="button" className="ui-ghost ui-ghost--primary" onClick={runSensorTest}>
                      <Wifi className="h-4 w-4" /> {t("settings.iot.ping")}
                    </button>
                  </div>
                  {sensorTest.last && (
                    <p className="text-xs text-muted-foreground">
                      {t("settings.iot.results.last_measure")}:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {sensorTest.last.value ?? "—"} ppm
                      </span>
                    </p>
                  )}
                  {sensorTest.linkOk !== null && (
                    <p className="text-xs text-muted-foreground">
                      {t("settings.iot.results.mqtt_status")}:{" "}
                      <span className="font-semibold text-foreground">
                        {sensorTest.linkOk ? t("link_ok") : t("link_lost")}
                      </span>
                    </p>
                  )}
                </div>
              </GlassCard>
            )}

            {!loading && activeTab === "placement" && (isAdmin || isTechnician) && (
              <GlassCard className="p-4 space-y-4">
                <SectionHeader icon={Compass} title={t("settings.positioning.title")} />
                <p className="text-xs text-muted-foreground">{t("settings.positioning.desc")}</p>
                <Link
                  to="/ia-placement"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/15 transition"
                >
                  {t("sidebar_placement")} <ExternalLink className="h-4 w-4" />
                </Link>
                <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settings.positioning.zones_testees")}
                  </p>
                  <div className="mt-2 grid gap-2">
                    {positions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      positions.map((z) => (
                        <div
                          key={String(z.id)}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{z.name || "—"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{z.zone}</p>
                          </div>
                          {(z.recommended || z.isFinal || z.is_final) && (
                            <span className="ui-badge text-primary shrink-0">{t("settings.positioning.recommended")}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </GlassCard>
            )}

            {!loading && activeTab === "team" && isAdmin && (
              <GlassCard className="p-4 space-y-4">
                <SectionHeader icon={Users} title={t("settings.users.title")} />
                <p className="text-xs text-muted-foreground">{t("settings.users.desc")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    className="ui-pill"
                    placeholder={t("settings.users.invite.name")}
                    value={invite.name}
                    onChange={(e) => setInvite((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className="ui-pill"
                    type="email"
                    placeholder={t("settings.users.invite.email")}
                    value={invite.email}
                    onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                  />
                  <select
                    className="ui-pill"
                    value={invite.role}
                    onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}
                  >
                    <option value="CLIENT">{t("settings.users.roles.CLIENT")}</option>
                    <option value="TECHNICIAN">{t("settings.users.roles.TECHNICIAN")}</option>
                    <option value="ADMIN">{t("settings.users.roles.ADMIN")}</option>
                  </select>
                  <button type="button" className="ui-ghost ui-ghost--primary" onClick={inviteUser}>
                    <Zap className="h-4 w-4" /> {t("settings.users.invite.button")}
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground border-b border-border/60">
                    <span>{t("settings.users.table.name")}</span>
                    <span>{t("settings.users.table.email")}</span>
                    <span>{t("settings.users.table.role")}</span>
                  </div>
                  {users.length === 0 ? (
                    <p className="px-3 py-6 text-xs text-muted-foreground">—</p>
                  ) : (
                    users.map((u) => (
                      <div
                        key={String(u.companyUserId || u.id)}
                        className="grid grid-cols-3 gap-2 px-3 py-2 text-xs border-b border-border/40 last:border-b-0 items-center"
                      >
                        <span className="truncate font-semibold">{u.name || "—"}</span>
                        <span className="truncate text-muted-foreground">{u.email || "—"}</span>
                        <select
                          className="ui-pill w-full"
                          value={String(u.role || "CLIENT").toUpperCase()}
                          onChange={(e) => updateUserRole(u.companyUserId || u.id, e.target.value)}
                        >
                          <option value="CLIENT">{t("settings.users.roles.CLIENT")}</option>
                          <option value="TECHNICIAN">{t("settings.users.roles.TECHNICIAN")}</option>
                          <option value="ADMIN">{t("settings.users.roles.ADMIN")}</option>
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </AppLayout>
    </div>
  );
}
