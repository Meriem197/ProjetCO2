import React from "react";
import { PremiumCard, StatusIndicator, FloatingElement, EnvironmentBadge, PulseRing, GradientDivider, } from "@/components/theme/PremiumElements";
import { Wind, Droplets, Activity, AlertCircle, TrendingUp } from "lucide-react";
/**
 * ThemeShowcase - Démonstration complète du thème premium
 */
export default function ThemeShowcase() {
    return (<div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-16 text-center">
        <h1 className="heading-hero mb-4">🌍 Theme Premium CO₂</h1>
        <p className="text-lg text-muted-foreground">
          Design professionnel & élégant basé sur l'environnement et les nuages
        </p>
      </div>

      {/* Sections */}
      <div className="max-w-7xl mx-auto space-y-16">
        {/* ━━━ SECTION 1: STATUS INDICATORS ━━━ */}
        <section>
          <h2 className="heading-section mb-8">Indicateurs de Statut</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PremiumCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Bon</h3>
                <StatusIndicator status="good" animated/>
              </div>
              <p className="text-sm text-muted-foreground">
                Concentration CO₂ normale, environnement sain
              </p>
              <div className="mt-4 text-3xl font-bold text-status-good">380 ppm</div>
            </PremiumCard>

            <PremiumCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Attention</h3>
                <StatusIndicator status="warning" animated/>
              </div>
              <p className="text-sm text-muted-foreground">
                Niveau de CO₂ élevé, action recommandée
              </p>
              <div className="mt-4 text-3xl font-bold text-status-warning">612 ppm</div>
            </PremiumCard>

            <PremiumCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Critique</h3>
                <StatusIndicator status="critical" animated/>
              </div>
              <p className="text-sm text-muted-foreground">
                CO₂ dangereux, intervention urgente requise
              </p>
              <div className="mt-4 text-3xl font-bold text-status-critical">950 ppm</div>
            </PremiumCard>
          </div>
        </section>

        <GradientDivider />

        {/* ━━━ SECTION 2: PREMIUM CARDS ━━━ */}
        <section>
          <h2 className="heading-section mb-8">Cartes Premium</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PremiumCard elevated>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Concentration actuelle
                  </p>
                  <h3 className="text-4xl font-bold text-gradient-primary">412 ppm</h3>
                </div>
                <FloatingElement>
                  <div className="w-16 h-16 rounded-full" style={{
            background: "linear-gradient(135deg, rgb(79, 172, 254), rgb(79, 142, 255))",
            boxShadow: "0 0 40px rgba(79, 172, 254, 0.3)",
        }}/>
                </FloatingElement>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Mesure en temps réel du capteur principal de la plateforme
              </p>
              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <EnvironmentBadge icon={<TrendingUp size={18}/>} label="Tendance" value="+2.3 ppm"/>
                  <EnvironmentBadge icon={<Activity size={18}/>} label="Statut" value="Stable"/>
                </div>
              </div>
            </PremiumCard>

            <PremiumCard elevated>
              <h3 className="font-semibold mb-6">Paramètres de Référence</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Air extérieur</span>
                  <span className="font-semibold text-primary">~420 ppm</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-status-good/10 border border-status-good/20">
                  <span className="text-sm font-medium">Bon</span>
                  <span className="font-semibold text-status-good">≤ 600 ppm</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-status-warning/10 border border-status-warning/20">
                  <span className="text-sm font-medium">Mauvais</span>
                  <span className="font-semibold text-status-warning">600 - 1000 ppm</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-status-critical/10 border border-status-critical/20">
                  <span className="text-sm font-medium">Critique</span>
                  <span className="font-semibold text-status-critical">> 1000 ppm</span>
                </div>
              </div>
            </PremiumCard>
          </div>
        </section>

        <GradientDivider />

        {/* ━━━ SECTION 3: ENVIRONMENT BADGES ━━━ */}
        <section>
          <h2 className="heading-section mb-8">Badges Environnement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <EnvironmentBadge icon={<Wind size={20}/>} label="Débit d'air" value="2.3 m/s"/>
            <EnvironmentBadge icon={<Droplets size={20}/>} label="Humidité" value="65%"/>
            <EnvironmentBadge icon={<Activity size={20}/>} label="Température" value="22°C"/>
            <EnvironmentBadge icon={<AlertCircle size={20}/>} label="Alerte" value="Aucune"/>
          </div>
        </section>

        <GradientDivider />

        {/* ━━━ SECTION 4: ANIMATIONS ━━━ */}
        <section>
          <h2 className="heading-section mb-8">Animations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Float Cloud */}
            <PremiumCard>
              <p className="text-sm text-muted-foreground mb-4">Animation: Float Cloud</p>
              <div className="flex justify-center py-8">
                <FloatingElement delay={0}>
                  <div className="w-20 h-20 rounded-full" style={{
            background: "linear-gradient(135deg, rgb(79, 172, 254), rgb(34, 197, 94))",
            boxShadow: "0 0 40px rgba(79, 172, 254, 0.3)",
        }}/>
                </FloatingElement>
              </div>
            </PremiumCard>

            {/* Drift Slow */}
            <PremiumCard>
              <p className="text-sm text-muted-foreground mb-4">Animation: Drift Slow</p>
              <div className="flex justify-center py-8">
                <div className="animate-drift-slow">
                  <div className="w-20 h-20 rounded-full" style={{
            background: "linear-gradient(135deg, rgb(34, 197, 94), rgb(79, 172, 254))",
            boxShadow: "0 0 40px rgba(34, 197, 94, 0.3)",
        }}/>
                </div>
              </div>
            </PremiumCard>

            {/* Pulse */}
            <PremiumCard>
              <p className="text-sm text-muted-foreground mb-4">Animation: Glow Pulse</p>
              <div className="flex justify-center py-8">
                <div className="animate-glow-pulse w-20 h-20 rounded-full bg-primary"/>
              </div>
            </PremiumCard>

            {/* Spring Pop */}
            <PremiumCard>
              <p className="text-sm text-muted-foreground mb-4">Animation: Spring Pop</p>
              <div className="flex justify-center py-8">
                <div className="animate-spring-pop w-20 h-20 rounded-full bg-accent"/>
              </div>
            </PremiumCard>
          </div>
        </section>

        <GradientDivider />

        {/* ━━━ SECTION 5: PULSE RINGS ━━━ */}
        <section>
          <h2 className="heading-section mb-8">Pulse Rings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PremiumCard className="flex items-center justify-center">
              <PulseRing color="primary" size="w-24 h-24"/>
            </PremiumCard>
            <PremiumCard className="flex items-center justify-center">
              <PulseRing color="accent" size="w-24 h-24"/>
            </PremiumCard>
            <PremiumCard className="flex items-center justify-center">
              <PulseRing color="warning" size="w-24 h-24"/>
            </PremiumCard>
            <PremiumCard className="flex items-center justify-center">
              <PulseRing color="critical" size="w-24 h-24"/>
            </PremiumCard>
          </div>
        </section>

        <GradientDivider />

        {/* ━━━ SECTION 6: COLOR PALETTE ━━━ */}
        <section>
          <h2 className="heading-section mb-8">Palette de Couleurs</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
            { label: "Primary", color: "bg-primary" },
            { label: "Secondary", color: "bg-secondary" },
            { label: "Good", color: "bg-status-good" },
            { label: "Warning", color: "bg-status-warning" },
            { label: "Critical", color: "bg-status-critical" },
            { label: "Accent", color: "bg-accent" },
            { label: "Muted", color: "bg-muted" },
            { label: "Card", color: "bg-card" },
        ].map((item) => (<div key={item.label} className="text-center">
                <div className={`${item.color} h-20 rounded-lg mb-2 shadow-card`}/>
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              </div>))}
          </div>
        </section>

        {/* Footer */}
        <div className="mt-20 text-center py-12 border-t border-border">
          <h3 className="font-semibold mb-2">Thème Premium CO₂</h3>
          <p className="text-sm text-muted-foreground">
            Design professionnel basé sur Cloud Morphism & Modern Minimalism
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Consulter <code className="bg-muted px-2 py-1 rounded">THEME_GUIDE.md</code> pour la
            documentation complète
          </p>
        </div>
      </div>
    </div>);
}
