import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { DateField } from "@/src/components/DateField";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";
import { createPregnancy } from "@/src/api/mch";
import { validateDate, shiftISO, todayISO } from "@/src/utils/date";
import {
  assessRisk,
  COMORBIDITY_OPTIONS,
  MANUAL_FACTOR_OPTIONS,
  type ComorbidityKey,
  type RiskFactorSection,
} from "@/src/utils/riskAssessment";

// A plausible LMP sits within the last ~43 weeks and never in the future.
const LMP_MIN = shiftISO(-300);
const LMP_MAX = todayISO();

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  testID: string;
  required?: boolean;
  maxLength?: number;
}
// Top-level (stable identity — no remount on keystroke) but theme-aware.
const Field: React.FC<FieldProps> = ({ label, value, onChangeText, placeholder, keyboardType, testID, required, maxLength }) => {
  const t = useTheme();
  const styles = useMemo(() => makeFieldStyles(t), [t]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={{ color: t.colors.error }}> *</Text> : null}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength ?? 80}
      />
    </View>
  );
};

// -- High-Risk Pregnancy section 4 (Maternal Medical Conditions) reuses the shared
// comorbidities array for all 7 conditions, including diabetes.
const MC_LABEL_KEY = {
  // Diabetes and HIV listed first (and bolded in render) — flagged for
  // visibility per an explicit ask, not buried among the other conditions.
  diabetes: "ccDiabetes",
  hiv: "mcHiv",
  cardiac: "mcHeart",
  kidney: "mcKidney",
  thyroid: "mcThyroid",
  epilepsy: "mcEpilepsy",
  tb: "mcTb",
} as const satisfies Partial<Record<ComorbidityKey, string>>;

// diabetes and hiv get emphasis — bolder row + listed first in the group —
// per an explicit visibility ask.
const EMPHASIZED_COMORBIDITIES = new Set<ComorbidityKey>(["diabetes", "hiv"]);

// Manual factor -> i18n label key, grouped by RiskFactorSection. Excludes the
// "legacy" previous_stillbirth_or_pph entry (ANC follow-up form only).
const REG_LABEL_KEY = {
  previous_c_section: "obPrevCSection",
  previous_stillbirth: "obPrevStillbirth",
  previous_preterm: "obPrevPreterm",
  previous_recurrent_abortion: "obPrevRecurrentAbortion",
  previous_congenital_anomaly: "obPrevCongenitalAnomaly",
  previous_pph: "obPrevPph",
  previous_severe_preeclampsia: "obPrevSeverePreeclampsia",
  hypertension: "ccHypertension",
  severe_anaemia: "ccAnaemia",
  aph: "ccAph",
  multiple_gestation: "ccMultiple",
  malpresentation: "ccMalpresentation",
  placenta_previa: "ccPlacentaPrevia",
  fgr: "ccFgr",
  rh_isoimmunisation: "ccRh",
  amniotic_fluid_abnormal: "ccAmnioticFluid",
  congenital_fetal_anomaly: "ccCongenitalFetal",
  respiratory_disease: "mcRespiratory",
  autoimmune_disorder: "mcAutoimmune",
  bmi_abnormal: "prBmi",
  poor_nutrition: "prNutrition",
  poor_antenatal_care: "prAntenatalCare",
  post_term: "prPostTerm",
  prolonged_rom: "prProlongedRom",
  short_stature: "shortStature",
} as const;

const SECTION_TITLE_KEY: Record<RiskFactorSection, string> = {
  obstetric_history: "obHistoryTitle",
  current_complications: "complicationsTitle",
  medical_conditions: "medicalTitle",
  pregnancy_related: "pregRelatedTitle",
};

const REG_FACTOR_ROWS = MANUAL_FACTOR_OPTIONS.filter(
  (f): f is Extract<typeof MANUAL_FACTOR_OPTIONS[number], { section: RiskFactorSection }> => f.section !== "legacy",
);

const initialFactors = {
  // Previous Obstetric History
  previous_c_section: false,
  previous_stillbirth: false,
  previous_preterm: false,
  previous_recurrent_abortion: false,
  previous_congenital_anomaly: false,
  previous_pph: false,
  previous_severe_preeclampsia: false,
  // Current Pregnancy Complications
  hypertension: false,
  severe_anaemia: false,
  aph: false,
  multiple_gestation: false,
  malpresentation: false,
  placenta_previa: false,
  fgr: false,
  rh_isoimmunisation: false,
  amniotic_fluid_abnormal: false,
  congenital_fetal_anomaly: false,
  // Maternal Medical Conditions
  respiratory_disease: false,
  autoimmune_disorder: false,
  // Pregnancy-Related Factors
  bmi_abnormal: false,
  poor_nutrition: false,
  poor_antenatal_care: false,
  post_term: false,
  prolonged_rom: false,
  short_stature: false,
  // clinician escape hatch
  critical_override: false,
};

export default function RegisterPregnancyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isSimulatedOffline, addToOfflineQueue } = useOfflineSync();

  const [form, setForm] = useState({
    rcn_id: "",
    full_name: "",
    husband_name: "",
    age: "",
    mobile_number: "",
    village: "",
    address: "",
    block: "",
    district: "",
    lmp: "",
    gravida: "1",
    para: "0",
    blood_group: "O+",
  });
  const [cardUri, setCardUri] = useState<string | null>(null);
  const [factors, setFactors] = useState(initialFactors);
  const [comorbidities, setComorbidities] = useState<ComorbidityKey[]>([]);
  const [otherAbnormalityText, setOtherAbnormalityText] = useState("");
  // medical_conditions (diabetes + HIV) starts expanded, and current_complications
  // too (other complications workers check often), so nothing is buried behind a tap.
  const [expanded, setExpanded] = useState<Record<RiskFactorSection, boolean>>({
    obstetric_history: false,
    current_complications: true,
    medical_conditions: true,
    pregnancy_related: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [lmpError, setLmpError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggleFactor = (k: keyof typeof factors) => setFactors((f) => ({ ...f, [k]: !f[k] }));
  const toggleComorbidity = (k: ComorbidityKey) =>
    setComorbidities((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const toggleSection = (k: RiskFactorSection) => setExpanded((e) => ({ ...e, [k]: !e[k] }));

  const ageNum = form.age.trim() ? Number(form.age) : null;
  const ageUnder18 = ageNum != null && !Number.isNaN(ageNum) && ageNum < 18;
  const age35Plus = ageNum != null && !Number.isNaN(ageNum) && ageNum >= 35;
  const age40Plus = ageNum != null && !Number.isNaN(ageNum) && ageNum >= 40;

  // Live "Critical Pregnancy" determination — recomputed as the form changes,
  // aggregating maternal-age auto-flags, the other numeric auto-flags (grand
  // multipara, Rh-negative), and every checkbox across all 4 manual sections.
  const risk = useMemo(
    () =>
      assessRisk({
        age: ageNum,
        gravida: Number(form.gravida) || 1,
        blood_group: form.blood_group,
        comorbidities,
        other_abnormality_text: otherAbnormalityText,
        ...factors,
      }),
    [ageNum, form.gravida, form.blood_group, factors, comorbidities, otherAbnormalityText],
  );

  // Auto-flags with age excluded — age gets its own "Maternal Age" section below,
  // so this only ever surfaces grand-multipara / Rh-negative.
  const otherAutoFlags = useMemo(
    () => assessRisk({ gravida: Number(form.gravida) || 1, blood_group: form.blood_group }).auto_flags,
    [form.gravida, form.blood_group],
  );

  const pickCard = async (source: "camera" | "library") => {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast("Permission denied for photo access.", "error");
        return;
      }
      const res =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
      if (!res.canceled && res.assets?.[0]?.uri) setCardUri(res.assets[0].uri);
    } catch (e: any) {
      showToast("Camera unavailable on this device. Use gallery instead.", "info");
    }
  };

  const setLmp = (v: string) => {
    setForm((f) => ({ ...f, lmp: v }));
    if (lmpError) setLmpError(null);
  };

  const validate = () => {
    if (!form.full_name.trim()) return "Full name is required.";
    const age = Number(form.age);
    if (!form.age.trim() || isNaN(age) || age < 10 || age > 60) return "Enter a valid age between 10 and 60.";
    if (!/^\d{10}$/.test(form.mobile_number.trim())) return "Enter a valid 10-digit mobile number.";
    if (!form.village.trim()) return "Village is required.";
    const lmpMsg = validateDate(form.lmp, { min: LMP_MIN, max: LMP_MAX, label: "LMP" });
    if (lmpMsg) { setLmpError(lmpMsg); return lmpMsg; }
    return null;
  };

  const buildPayload = () => ({
    rcn_id: form.rcn_id.trim() || undefined,
    full_name: form.full_name.trim(),
    husband_name: form.husband_name.trim(),
    age: Number(form.age),
    mobile_number: form.mobile_number.trim(),
    village: form.village.trim(),
    address: form.address.trim() || form.village.trim(),
    block: form.block.trim() || undefined,
    district: form.district.trim() || undefined,
    lmp: form.lmp.trim(),
    gravida: Number(form.gravida) || 1,
    para: Number(form.para) || 0,
    blood_group: form.blood_group,
    health_slip_uri: cardUri || undefined,
    ...factors,
    other_abnormality_text: otherAbnormalityText.trim() || undefined,
    comorbidities,
    assigned_worker_id: user?.id || "",
    assigned_worker_name: user?.name || "",
  });

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      showToast(err, "error");
      return;
    }
    const payload = buildPayload();
    setSubmitting(true);

    if (isSimulatedOffline) {
      await addToOfflineQueue({
        entity_type: "pregnancy",
        payload,
        worker_id: user?.id || "",
        display_title: `Pregnancy: ${payload.full_name}`,
        display_subtitle: `${payload.village} • Queued offline`,
      } as any);
      setSubmitting(false);
      showToast("Saved offline. Will sync when back online.", "info");
      router.back();
      return;
    }

    try {
      await createPregnancy(payload);
      showToast("Pregnancy registered successfully.", "success");
      router.back();
    } catch (e: any) {
      await addToOfflineQueue({
        entity_type: "pregnancy",
        payload,
        worker_id: user?.id || "",
        display_title: `Pregnancy: ${payload.full_name}`,
        display_subtitle: `${payload.village} • Pending sync`,
      } as any);
      showToast("Server unreachable. Record saved locally for sync.", "info");
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const P = tr.regPersonal;
  const RF: any = tr.riskFactors;

  // Section config: key, i18n title key, factor rows, plus any extra rows
  // (comorbidity chips-turned-checkboxes) rendered inline with the same style.
  const sectionRows = (section: RiskFactorSection) => REG_FACTOR_ROWS.filter((f) => f.section === section);
  const sectionCount = (section: RiskFactorSection): number => {
    let n = sectionRows(section).filter((f) => factors[f.key as keyof typeof factors]).length;
    if (section === "medical_conditions") n += comorbidities.length;
    if (section === "pregnancy_related" && otherAbnormalityText.trim()) n += 1;
    return n;
  };

  const renderCheckRow = (key: string, label: string, checked: boolean, onPress: () => void, testID: string, emphasized = false) => (
    <Pressable key={key} testID={testID} onPress={onPress} style={styles.checkRow}>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? t.colors.error : t.colors.textMuted} />
      <Text style={[styles.checkRowText, emphasized && styles.checkRowTextEmphasized]}>{label}</Text>
    </Pressable>
  );

  const renderSection = (section: RiskFactorSection) => {
    const count = sectionCount(section);
    const isOpen = expanded[section];
    return (
      <View key={section} style={styles.sectionCard}>
        <Pressable testID={`reg-section-toggle-${section}`} onPress={() => toggleSection(section)} style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>{RF[SECTION_TITLE_KEY[section]]}</Text>
          {count > 0 ? (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{count}</Text>
            </View>
          ) : null}
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={t.colors.textMuted} />
        </Pressable>

        {isOpen ? (
          <View style={styles.sectionBody}>
            {/* diabetes / HIV render first in their group and bolder — flagged
                for visibility, not buried among the other checkboxes. */}
            {section === "medical_conditions" &&
              (Object.keys(MC_LABEL_KEY) as ComorbidityKey[]).map((key) =>
                renderCheckRow(
                  key,
                  RF[(MC_LABEL_KEY as any)[key]],
                  comorbidities.includes(key),
                  () => toggleComorbidity(key),
                  `reg-cm-${key}`,
                  EMPHASIZED_COMORBIDITIES.has(key),
                ),
              )}

            {sectionRows(section).map((f) =>
              renderCheckRow(
                f.key,
                RF[(REG_LABEL_KEY as any)[f.key]],
                factors[f.key as keyof typeof factors],
                () => toggleFactor(f.key as keyof typeof factors),
                `reg-factor-${f.key}`,
              ),
            )}

            {section === "pregnancy_related" ? (
              <>
                <View style={styles.noteBox}>
                  <Ionicons name="information-circle-outline" size={14} color={t.colors.textMuted} />
                  <Text style={styles.noteText}>{RF.teenageOverlapNote}</Text>
                </View>
                <Text style={[styles.label, { marginTop: 4 }]}>{RF.prOtherLabel}</Text>
                <TextInput
                  testID="reg-other-abnormality"
                  style={styles.textArea}
                  value={otherAbnormalityText}
                  onChangeText={setOtherAbnormalityText}
                  placeholder={RF.prOtherPlaceholder}
                  placeholderTextColor={t.colors.textMuted}
                  multiline
                />
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Header title="Register Pregnancy" showBack showOfflineToggle={false} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {/* RCN Card photo — stored as a local URI, no OCR. Captured first so its
            ID can be transcribed into the RCN ID field below. */}
        <Text style={styles.sectionTitle}>{tr.riskFactors.rcnCardTitle}</Text>
        <Text style={styles.hint}>{tr.riskFactors.rcnCardHint}</Text>
        {cardUri ? (
          <View style={styles.slipPreviewRow}>
            <Image testID="reg-card-thumb" source={{ uri: cardUri }} style={styles.slipThumb} resizeMode="cover" />
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable testID="reg-card-replace" onPress={() => pickCard("library")} style={styles.slipSmallBtn}>
                <Ionicons name="repeat" size={15} color={t.colors.brandDark} />
                <Text style={styles.slipSmallBtnText}>{tr.riskFactors.slipChange}</Text>
              </Pressable>
              <Pressable testID="reg-card-remove" onPress={() => setCardUri(null)} style={styles.slipSmallBtn}>
                <Ionicons name="trash-outline" size={15} color={t.colors.error} />
                <Text style={[styles.slipSmallBtnText, { color: t.colors.error }]}>{tr.riskFactors.slipRemove}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.slipBtnRow}>
            <Pressable testID="reg-card-camera" onPress={() => pickCard("camera")} style={styles.slipBtn}>
              <Ionicons name="camera" size={18} color={t.colors.brandDark} />
              <Text style={styles.slipBtnText}>{tr.riskFactors.slipCamera}</Text>
            </Pressable>
            <Pressable testID="reg-card-gallery" onPress={() => pickCard("library")} style={styles.slipBtn}>
              <Ionicons name="images" size={18} color={t.colors.brandDark} />
              <Text style={styles.slipBtnText}>{tr.riskFactors.slipGallery}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>{P.sectionTitle}</Text>
        <Field testID="reg-rcn-id" label={P.rcnId} value={form.rcn_id} onChangeText={set("rcn_id")} placeholder={P.phRcnId} />
        <Field testID="reg-full-name" label={P.fullName} value={form.full_name} onChangeText={set("full_name")} placeholder={P.phFullName} required />
        <Field testID="reg-husband-name" label={P.husbandName} value={form.husband_name} onChangeText={set("husband_name")} placeholder={P.phHusbandName} />
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}><Field testID="reg-age" label={P.age} value={form.age} onChangeText={set("age")} placeholder={P.phAge} keyboardType="number-pad" required /></View>
          <View style={{ flex: 1 }}><Field testID="reg-mobile" label={P.mobile} value={form.mobile_number} onChangeText={set("mobile_number")} placeholder={P.phMobile} keyboardType="phone-pad" required /></View>
        </View>
        <Field testID="reg-village" label={P.village} value={form.village} onChangeText={set("village")} placeholder={P.phVillage} required />
        <Field testID="reg-address" label={P.address} value={form.address} onChangeText={set("address")} placeholder={P.phAddress} />
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}><Field testID="reg-block" label={P.block} value={form.block} onChangeText={set("block")} placeholder={P.phBlock} /></View>
          <View style={{ flex: 1 }}><Field testID="reg-district" label={P.district} value={form.district} onChangeText={set("district")} placeholder={P.phDistrict} /></View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{P.lmp}<Text style={{ color: t.colors.error }}> *</Text></Text>
          <DateField testID="reg-lmp" value={form.lmp} onChange={setLmp} min={LMP_MIN} max={LMP_MAX} error={lmpError} />
        </View>
        <Text style={styles.hint}>{P.lmpHint}</Text>
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}><Field testID="reg-gravida" label={P.gravida} value={form.gravida} onChangeText={set("gravida")} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field testID="reg-para" label={P.para} value={form.para} onChangeText={set("para")} keyboardType="number-pad" /></View>
        </View>

        <Text style={styles.label}>{P.bloodGroup}</Text>
        <View style={styles.bgRow}>
          {BLOOD_GROUPS.map((bg) => (
            <Pressable key={bg} testID={`reg-bg-${bg}`} onPress={() => set("blood_group")(bg)} style={[styles.bgChip, form.blood_group === bg && styles.bgChipActive]}>
              <Text style={[styles.bgChipText, form.blood_group === bg && styles.bgChipTextActive]}>{bg}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{tr.riskFactors.sectionTitle}</Text>
        <Text style={styles.hint}>{tr.riskFactors.sectionHint}</Text>

        {/* 1. Maternal Age — fully auto-detected, no checkbox (thresholds can overlap). */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>{RF.maternalAgeTitle}</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.autoHint}>{RF.maternalAgeHint}</Text>
            {[
              ["age-under-18", RF.ageUnder18, ageUnder18],
              ["age-35-plus", RF.age35Plus, age35Plus],
              ["age-40-plus", RF.age40Plus, age40Plus],
            ].map(([key, label, on]: any) => (
              <View key={key} testID={`reg-auto-${key}`} style={styles.autoAgeRow}>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={20} color={on ? t.colors.error : t.colors.textMuted} />
                <Text style={[styles.checkRowText, on && styles.autoAgeTextOn]}>{label}</Text>
                {on ? (
                  <View style={styles.autoTag}>
                    <Text style={styles.autoTagText}>{RF.autoTag}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {/* Remaining auto-detected (grand multipara, Rh-negative) — unchanged logic, own compact block. */}
        <Text style={[styles.subLabel, { marginTop: 4 }]}>{RF.autoTitle}</Text>
        {otherAutoFlags.length === 0 ? (
          <Text style={styles.autoNone}>{RF.autoNone}</Text>
        ) : (
          otherAutoFlags.map((r) => (
            <View key={r} style={styles.autoRow}>
              <Ionicons name="checkmark-circle" size={16} color={t.colors.error} />
              <Text style={styles.autoRowText}>{r}</Text>
            </View>
          ))
        )}

        <View style={styles.divider} />

        {/* 2-5. Previous Obstetric History / Current Pregnancy Complications /
            Maternal Medical Conditions / Pregnancy-Related Factors — collapsible
            so this many checkboxes doesn't read as one long wall of text. */}
        {renderSection("obstetric_history")}
        {renderSection("current_complications")}
        {renderSection("medical_conditions")}
        {renderSection("pregnancy_related")}

        <Pressable testID="reg-critical-override" onPress={() => toggleFactor("critical_override")} style={[styles.checkRow, { marginTop: 10 }]}>
          <Ionicons name={factors.critical_override ? "checkbox" : "square-outline"} size={22} color={factors.critical_override ? t.colors.error : t.colors.textMuted} />
          <Text style={styles.checkRowText}>{tr.riskFactors.clinicianOverride}</Text>
        </Pressable>

        <View testID="reg-critical-banner" style={[styles.critBanner, risk.is_critical ? styles.critBannerOn : styles.critBannerOff]}>
          <Ionicons name={risk.is_critical ? "warning" : "checkmark-circle"} size={18} color={risk.is_critical ? t.colors.onStatus : t.colors.successText} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.critBannerTitle, { color: risk.is_critical ? t.colors.onStatus : t.colors.successText }]}>
              {risk.is_critical ? tr.riskFactors.criticalYes : tr.riskFactors.criticalNo}
            </Text>
            {risk.is_critical ? (
              <Text style={[styles.critBannerReasons, { color: t.colors.onStatus }]}>
                {tr.riskFactors.triggeredBy} {risk.reasons.join("; ")}
              </Text>
            ) : null}
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable testID="reg-submit-btn" onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, submitting && { opacity: 0.6 }]}>
          {submitting ? (
            <ActivityIndicator color={t.colors.onBrand} />
          ) : (
            <>
              <Ionicons name={isSimulatedOffline ? "cloud-offline" : "save"} size={18} color={t.colors.onBrand} />
              <Text style={styles.submitText}>{isSimulatedOffline ? "Save Offline" : "Register Pregnancy"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeFieldStyles = (t: Theme) =>
  StyleSheet.create({
    field: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: "700", color: t.colors.textPrimary, marginBottom: 6 },
    input: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 46, fontSize: 14, color: t.colors.textPrimary },
  });

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: t.colors.brandText, marginTop: 16, marginBottom: 10 },
    subLabel: { fontSize: 12, fontWeight: "800", color: t.colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
    field: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: "700", color: t.colors.textPrimary, marginBottom: 6 },
    rowTwo: { flexDirection: "row", gap: 10 },
    hint: { fontSize: 12, color: t.colors.textMuted, marginTop: -4, marginBottom: 10, fontStyle: "italic" },
    bgRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    bgChip: { width: 54, height: 44, borderRadius: t.radius.sm, backgroundColor: t.colors.surfaceSecondary, borderWidth: 1, borderColor: t.colors.border, alignItems: "center", justifyContent: "center" },
    bgChipActive: { backgroundColor: t.colors.brand, borderColor: t.colors.brand },
    bgChipText: { fontSize: 13, fontWeight: "700", color: t.colors.textSecondary },
    bgChipTextActive: { color: t.colors.onBrand },
    slipBtnRow: { flexDirection: "row", gap: 10 },
    slipBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.colors.brandLight, borderRadius: t.radius.md, paddingVertical: 14 },
    slipBtnText: { fontSize: 13, fontWeight: "700", color: t.colors.brandDark },
    slipPreviewRow: { flexDirection: "row", gap: 12, alignItems: "center" },
    slipThumb: { width: 96, height: 128, borderRadius: t.radius.sm, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surfaceTertiary },
    slipSmallBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.colors.surfaceSecondary, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.sm, paddingVertical: 10, paddingHorizontal: 12 },
    slipSmallBtnText: { fontSize: 13, fontWeight: "700", color: t.colors.brandDark },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    checkRowText: { flex: 1, fontSize: 13, fontWeight: "600", color: t.colors.textPrimary, lineHeight: 18 },
    checkRowTextEmphasized: { fontWeight: "800", color: t.colors.brandDark },
    autoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
    autoRowText: { flex: 1, fontSize: 13, fontWeight: "600", color: t.colors.errorText, lineHeight: 18 },
    autoNone: { fontSize: 13, color: t.colors.textMuted, paddingVertical: 6 },
    divider: { height: 1, backgroundColor: t.colors.divider, marginVertical: 10 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 4 },
    cmChip: { paddingHorizontal: 12, height: 40, justifyContent: "center", borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceSecondary, borderWidth: 1, borderColor: t.colors.border },
    cmChipActive: { backgroundColor: t.colors.errorLight, borderColor: t.colors.errorBorder },
    cmChipText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    cmChipTextActive: { color: t.colors.errorText },
    critBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: t.radius.md, padding: 12, marginTop: 14 },
    critBannerOn: { backgroundColor: t.colors.error },
    critBannerOff: { backgroundColor: t.colors.successLight },
    critBannerTitle: { fontSize: 13, fontWeight: "800" },
    critBannerReasons: { fontSize: 12, fontWeight: "600", marginTop: 3, lineHeight: 16 },
    footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: t.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: t.colors.border },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.brand, borderRadius: t.radius.md, height: 52 },
    submitText: { color: t.colors.onBrand, fontSize: 15, fontWeight: "700" },

    // -- Collapsible high-risk sections (progressive disclosure: 24 new checkboxes
    // across 4 groups would otherwise be one unbroken wall of text) --
    sectionCard: { borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surfaceSecondary, marginBottom: 10, overflow: "hidden" },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 13 },
    sectionHeaderTitle: { flex: 1, fontSize: 13, fontWeight: "800", color: t.colors.textPrimary },
    sectionBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: t.colors.error, alignItems: "center", justifyContent: "center" },
    sectionBadgeText: { fontSize: 11, fontWeight: "800", color: t.colors.onStatus },
    sectionBody: { paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: 1, borderTopColor: t.colors.border },
    autoHint: { fontSize: 12, color: t.colors.textMuted, fontStyle: "italic", marginTop: 10, marginBottom: 2 },
    autoAgeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
    autoAgeTextOn: { color: t.colors.errorText, fontWeight: "700" },
    autoTag: { paddingHorizontal: 7, height: 18, borderRadius: t.radius.pill, backgroundColor: t.colors.errorLight, alignItems: "center", justifyContent: "center" },
    autoTagText: { fontSize: 9, fontWeight: "800", color: t.colors.errorText, textTransform: "uppercase", letterSpacing: 0.3 },
    noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.sm, padding: 8, marginTop: 8, marginBottom: 4 },
    noteText: { flex: 1, fontSize: 11, color: t.colors.textMuted, lineHeight: 15, fontStyle: "italic" },
    textArea: { backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, paddingTop: 10, height: 66, fontSize: 14, color: t.colors.textPrimary, textAlignVertical: "top", marginBottom: 8 },
  });
