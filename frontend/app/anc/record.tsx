import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { DateField } from "@/src/components/DateField";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";
import { createANCVisit } from "@/src/api/mch";
import { validateDate, todayISO, shiftISO } from "@/src/utils/date";
import { COMORBIDITY_OPTIONS, type ComorbidityKey } from "@/src/utils/riskAssessment";
import { useBlockAdminWrite } from "@/src/hooks/use-admin-guard";

const CM_LABEL_KEY = {
  diabetes: "cmDiabetes",
  cardiac: "cmCardiac",
  thyroid: "cmThyroid",
  epilepsy: "cmEpilepsy",
  kidney: "cmKidney",
  tb: "cmTb",
  hiv: "cmHiv",
} as const satisfies Record<ComorbidityKey, string>;

// Manual (Health Slip) checkboxes — [factor state key, i18n key].
const MANUAL_ROWS = [
  ["short_stature", "shortStature"],
  ["hypertension", "hypertension"],
  ["severe_anaemia", "severeAnaemia"],
  ["bmi_abnormal", "bmiAbnormal"],
  ["previous_c_section", "prevCSection"],
  ["previous_stillbirth_or_pph", "prevStillbirthPph"],
  ["multiple_gestation", "multipleGestation"],
] as const;

// Follow-up visit: from today out to roughly one more pregnancy's length.
const NEXT_VISIT_MIN = todayISO();
const NEXT_VISIT_MAX = shiftISO(300);

export default function ANCRecordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isSimulatedOffline, addToOfflineQueue } = useOfflineSync();
  const { pregnancyId, visitNumber } = useLocalSearchParams<{ pregnancyId: string; visitNumber: string }>();

  // Admin role is monitor/escalate/notify only — no writes on operational data,
  // enforced here so direct navigation to this route can't bypass it (not just
  // hiding the "Record ANC Visit" button that links here).
  const blocked = useBlockAdminWrite("Admins have view-only access. ANC visits are recorded by field workers.");

  const [form, setForm] = useState({
    symptoms: "",
    examination_notes: "",
    advice: "",
    next_visit_date: "",
  });
  const [factors, setFactors] = useState({
    short_stature: false,
    hypertension: false,
    severe_anaemia: false,
    bmi_abnormal: false,
    previous_c_section: false,
    previous_stillbirth_or_pph: false,
    multiple_gestation: false,
    critical_override: false,
  });
  const [comorbidities, setComorbidities] = useState<ComorbidityKey[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [nextVisitError, setNextVisitError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggleFactor = (k: keyof typeof factors) => setFactors((f) => ({ ...f, [k]: !f[k] }));
  const toggleComorbidity = (k: ComorbidityKey) =>
    setComorbidities((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const setNextVisit = (v: string) => {
    setForm((f) => ({ ...f, next_visit_date: v }));
    if (nextVisitError) setNextVisitError(null);
  };

  const handleSubmit = async () => {
    if (form.next_visit_date.trim()) {
      const nvMsg = validateDate(form.next_visit_date, { min: NEXT_VISIT_MIN, max: NEXT_VISIT_MAX, label: "Next visit date" });
      if (nvMsg) { setNextVisitError(nvMsg); showToast(nvMsg, "error"); return; }
    }
    const payload = {
      pregnancy_id: pregnancyId,
      visit_number: Number(visitNumber) || 1,
      symptoms: form.symptoms,
      examination_notes: form.examination_notes,
      advice: form.advice,
      next_visit_date: form.next_visit_date || undefined,
      // Risk factors identified at this visit — additive on the server; only
      // ticked ones are sent so a factor already on record is never cleared.
      ...(factors.short_stature ? { short_stature: true } : {}),
      ...(factors.hypertension ? { hypertension: true } : {}),
      ...(factors.severe_anaemia ? { severe_anaemia: true } : {}),
      ...(factors.bmi_abnormal ? { bmi_abnormal: true } : {}),
      ...(factors.previous_c_section ? { previous_c_section: true } : {}),
      ...(factors.previous_stillbirth_or_pph ? { previous_stillbirth_or_pph: true } : {}),
      ...(factors.multiple_gestation ? { multiple_gestation: true } : {}),
      ...(factors.critical_override ? { critical_override: true } : {}),
      ...(comorbidities.length ? { comorbidities } : {}),
    };
    setSubmitting(true);

    if (isSimulatedOffline) {
      await addToOfflineQueue({
        entity_type: "anc_visit",
        payload,
        worker_id: user?.id || "",
        display_title: `ANC Visit #${payload.visit_number}`,
        display_subtitle: "Queued offline",
      } as any);
      setSubmitting(false);
      showToast("ANC visit saved offline for sync.", "info");
      router.back();
      return;
    }

    try {
      await createANCVisit(pregnancyId!, payload);
      showToast("ANC visit recorded successfully.", "success");
      router.back();
    } catch (e: any) {
      await addToOfflineQueue({
        entity_type: "anc_visit",
        payload,
        worker_id: user?.id || "",
        display_title: `ANC Visit #${payload.visit_number}`,
        display_subtitle: "Pending sync",
      } as any);
      showToast("Server unreachable. Visit saved locally.", "info");
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const F = (label: string, key: keyof typeof form, ph: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`anc-${key}`}
        style={[styles.input, styles.inputMultiline]}
        value={form[key]}
        onChangeText={set(key)}
        placeholder={ph}
        placeholderTextColor={t.colors.textMuted}
        multiline
      />
    </View>
  );

  // Redirect is in flight (useBlockAdminWrite's effect) — render nothing rather
  // than flash the write form for an Admin who navigated here directly.
  if (blocked) return null;

  return (
    <View style={styles.root}>
      <Header title={`Record ANC Visit #${visitNumber || ""}`} showBack showOfflineToggle={false} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bottomOffset={20}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={t.colors.brandText} />
          <Text style={styles.infoText}>{tr.riskFactors.ancInfo}</Text>
        </View>

        <Text style={styles.sectionTitle}>{tr.riskFactors.ancNewlyIdentified}</Text>
        {MANUAL_ROWS.map(([key, k2]) => (
          <Pressable key={key} testID={`anc-factor-${key}`} onPress={() => toggleFactor(key)} style={styles.checkRow}>
            <Ionicons name={factors[key] ? "checkbox" : "square-outline"} size={22} color={factors[key] ? t.colors.error : t.colors.textMuted} />
            <Text style={styles.checkRowText}>{tr.riskFactors[k2]}</Text>
          </Pressable>
        ))}
        <Text style={[styles.label, { marginTop: 8 }]}>{tr.riskFactors.comorbiditiesLabel}</Text>
        <View style={styles.chipWrap}>
          {COMORBIDITY_OPTIONS.map((opt) => {
            const on = comorbidities.includes(opt.key);
            return (
              <Pressable key={opt.key} testID={`anc-cm-${opt.key}`} onPress={() => toggleComorbidity(opt.key)} style={[styles.cmChip, on && styles.cmChipActive]}>
                <Text style={[styles.cmChipText, on && styles.cmChipTextActive]}>{tr.riskFactors[CM_LABEL_KEY[opt.key]]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable testID="anc-factor-critical_override" onPress={() => toggleFactor("critical_override")} style={styles.checkRow}>
          <Ionicons name={factors.critical_override ? "checkbox" : "square-outline"} size={22} color={factors.critical_override ? t.colors.error : t.colors.textMuted} />
          <Text style={styles.checkRowText}>{tr.riskFactors.clinicianOverride}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Assessment</Text>
        {F("Symptoms", "symptoms", "Fetal movements, swelling, etc.")}
        {F("Examination Notes", "examination_notes", "Clinical observations")}
        {F("Advice Given", "advice", "IFA tablets, diet, follow-up")}
        <View style={styles.field}>
          <Text style={styles.label}>Next Visit Date</Text>
          <DateField
            testID="anc-next_visit_date"
            value={form.next_visit_date}
            onChange={setNextVisit}
            min={NEXT_VISIT_MIN}
            max={NEXT_VISIT_MAX}
            error={nextVisitError}
          />
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable testID="anc-submit-btn" onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, submitting && { opacity: 0.6 }]}>
          {submitting ? <ActivityIndicator color={t.colors.onBrand} /> : (
            <>
              <Ionicons name={isSimulatedOffline ? "cloud-offline" : "save"} size={18} color={t.colors.onBrand} />
              <Text style={styles.submitText}>{isSimulatedOffline ? "Save Offline" : "Save ANC Visit"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    infoBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.brandLight, borderRadius: t.radius.md, padding: 12, marginBottom: 8 },
    infoText: { flex: 1, fontSize: 12, color: t.colors.brandDark, fontWeight: "600" },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: t.colors.brandText, marginTop: 14, marginBottom: 10 },
    field: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: "700", color: t.colors.textPrimary, marginBottom: 6 },
    input: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 46, fontSize: 14, color: t.colors.textPrimary },
    inputMultiline: { height: 70, paddingTop: 10, textAlignVertical: "top" },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    checkRowText: { flex: 1, fontSize: 13, fontWeight: "600", color: t.colors.textPrimary, lineHeight: 18 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
    cmChip: { paddingHorizontal: 12, height: 40, justifyContent: "center", borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceSecondary, borderWidth: 1, borderColor: t.colors.border },
    cmChipActive: { backgroundColor: t.colors.errorLight, borderColor: t.colors.errorBorder },
    cmChipText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    cmChipTextActive: { color: t.colors.errorText },
    footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: t.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: t.colors.border },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.brand, borderRadius: t.radius.md, height: 52 },
    submitText: { color: t.colors.onBrand, fontSize: 15, fontWeight: "700" },
  });
