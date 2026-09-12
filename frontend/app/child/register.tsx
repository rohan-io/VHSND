import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { DateField } from "@/src/components/DateField";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";
import { createChild, listPregnancies, getPregnancy } from "@/src/api/mch";
import { PregnancyRecord } from "@/src/types";
import { validateDate, shiftISO, todayISO } from "@/src/utils/date";
import { isTrulyDelivered } from "@/src/utils/pregnancy";

// Newborn registration: DOB within the last ~6 years, never in the future.
const DOB_MIN = shiftISO(-366 * 6);
const DOB_MAX = todayISO();

export default function RegisterChildScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isSimulatedOffline, addToOfflineQueue } = useOfflineSync();
  const { motherId } = useLocalSearchParams<{ motherId: string }>();

  const [mother, setMother] = useState<{ id: string; name: string; village: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [mothers, setMothers] = useState<PregnancyRecord[]>([]);
  const [motherSearch, setMotherSearch] = useState("");

  const [form, setForm] = useState({
    child_name: "",
    dob: "",
    birth_weight: "3.0",
    place_of_birth: "PHC Hospital",
  });
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [submitting, setSubmitting] = useState(false);
  const [dobError, setDobError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setDob = (v: string) => {
    setForm((f) => ({ ...f, dob: v }));
    if (dobError) setDobError(null);
  };

  useEffect(() => {
    if (motherId) {
      getPregnancy(motherId).then((res) => {
        setMother({ id: res.pregnancy.id, name: res.pregnancy.full_name, village: res.pregnancy.village });
      }).catch(() => {});
    }
  }, [motherId]);

  const openPicker = async () => {
    setShowPicker(true);
    try {
      const res = await listPregnancies({});
      setMothers(res.items);
    } catch {}
  };

  const filteredMothers = mothers.filter((m) =>
    m.full_name.toLowerCase().includes(motherSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!mother) { showToast("Please select the mother.", "error"); return; }
    if (!form.child_name.trim()) { showToast("Child name is required.", "error"); return; }
    const dobMsg = validateDate(form.dob, { min: DOB_MIN, max: DOB_MAX, label: "Date of birth" });
    if (dobMsg) { setDobError(dobMsg); showToast(dobMsg, "error"); return; }

    const payload = {
      mother_id: mother.id,
      child_name: form.child_name.trim(),
      gender,
      dob: form.dob.trim(),
      birth_weight: Number(form.birth_weight) || 3.0,
      place_of_birth: form.place_of_birth.trim(),
      village: mother.village,
    };
    setSubmitting(true);

    if (isSimulatedOffline) {
      await addToOfflineQueue({
        entity_type: "child",
        payload,
        worker_id: user?.id || "",
        display_title: `Child: ${payload.child_name}`,
        display_subtitle: `Mother: ${mother.name} • Queued offline`,
      } as any);
      setSubmitting(false);
      showToast("Child saved offline for sync.", "info");
      router.back();
      return;
    }

    try {
      await createChild(payload);
      showToast("Child registered successfully.", "success");
      router.back();
    } catch (e: any) {
      await addToOfflineQueue({
        entity_type: "child",
        payload,
        worker_id: user?.id || "",
        display_title: `Child: ${payload.child_name}`,
        display_subtitle: `Mother: ${mother.name} • Pending sync`,
      } as any);
      showToast("Server unreachable. Child saved locally.", "info");
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Header title="Register Child" showBack showOfflineToggle={false} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bottomOffset={20}>
        <Text style={styles.sectionTitle}>Link to Mother</Text>
        <Pressable testID="child-select-mother-btn" onPress={openPicker} style={styles.motherSelect}>
          <Ionicons name="woman" size={18} color={t.colors.brandText} />
          <Text style={[styles.motherSelectText, !mother && { color: t.colors.textMuted }]}>
            {mother ? `${mother.name} (${mother.village})` : "Select mother / beneficiary"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={t.colors.textMuted} />
        </Pressable>

        <Text style={styles.sectionTitle}>Child Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Child Name</Text>
          <TextInput testID="child-name-input" style={styles.input} value={form.child_name} onChangeText={set("child_name")} placeholder="e.g. Aarav Kumar" placeholderTextColor={t.colors.textMuted} maxLength={80} />
        </View>

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {(["Male", "Female"] as const).map((g) => (
            <Pressable key={g} testID={`child-gender-${g}`} onPress={() => setGender(g)} style={[styles.genderChip, gender === g && styles.genderChipActive]}>
              <Ionicons name={g === "Male" ? "male" : "female"} size={16} color={gender === g ? t.colors.onBrand : t.colors.textSecondary} />
              <Text style={[styles.genderText, gender === g && { color: t.colors.onBrand }]}>{g}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Date of Birth</Text>
          <DateField
            testID="child-dob-input"
            value={form.dob}
            onChange={setDob}
            min={DOB_MIN}
            max={DOB_MAX}
            error={dobError}
          />
        </View>
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <View style={styles.field}>
              <Text style={styles.label}>Birth Weight (kg)</Text>
              <TextInput testID="child-weight-input" style={styles.input} value={form.birth_weight} onChangeText={set("birth_weight")} placeholder="3.0" keyboardType="decimal-pad" placeholderTextColor={t.colors.textMuted} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.field}>
              <Text style={styles.label}>Place of Birth</Text>
              <TextInput testID="child-place-input" style={styles.input} value={form.place_of_birth} onChangeText={set("place_of_birth")} placeholder="PHC Hospital" placeholderTextColor={t.colors.textMuted} />
            </View>
          </View>
        </View>
        <Text style={styles.hint}>Full immunisation schedule is auto-generated from DOB.</Text>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable testID="child-submit-btn" onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, submitting && { opacity: 0.6 }]}>
          {submitting ? <ActivityIndicator color={t.colors.onBrand} /> : (
            <>
              <Ionicons name={isSimulatedOffline ? "cloud-offline" : "save"} size={18} color={t.colors.onBrand} />
              <Text style={styles.submitText}>{isSimulatedOffline ? "Save Offline" : "Register Child"}</Text>
            </>
          )}
        </Pressable>
      </View>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Mother</Text>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={16} color={t.colors.textMuted} />
              <TextInput testID="mother-picker-search" style={styles.modalSearchInput} placeholder="Search mother name…" placeholderTextColor={t.colors.textMuted} value={motherSearch} onChangeText={setMotherSearch} />
            </View>
            <FlatList
              data={filteredMothers}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`mother-option-${item.id}`}
                  onPress={() => { setMother({ id: item.id, name: item.full_name, village: item.village }); setShowPicker(false); setMotherSearch(""); }}
                  style={styles.motherOption}
                >
                  <View style={styles.optAvatar}><Text style={styles.optAvatarText}>{item.full_name.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optName}>{item.full_name}</Text>
                    <Text style={styles.optSub}>{item.village} • {isTrulyDelivered(item) ? "Delivered" : item.gestational_age_label}</Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.hint}>No mothers found.</Text>}
            />
            <Pressable testID="mother-picker-close" onPress={() => setShowPicker(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: t.colors.brandText, marginTop: 14, marginBottom: 10 },
    motherSelect: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 50 },
    motherSelectText: { flex: 1, fontSize: 14, fontWeight: "600", color: t.colors.textPrimary },
    field: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: "700", color: t.colors.textPrimary, marginBottom: 6 },
    input: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 46, fontSize: 14, color: t.colors.textPrimary },
    rowTwo: { flexDirection: "row", gap: 10 },
    hint: { fontSize: 12, color: t.colors.textMuted, fontStyle: "italic", marginTop: 4 },
    genderRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
    genderChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: t.radius.md, backgroundColor: t.colors.surfaceSecondary, borderWidth: 1, borderColor: t.colors.border },
    genderChipActive: { backgroundColor: t.colors.brand, borderColor: t.colors.brand },
    genderText: { fontSize: 14, fontWeight: "700", color: t.colors.textSecondary },
    footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: t.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: t.colors.border },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.brand, borderRadius: t.radius.md, height: 52 },
    submitText: { color: t.colors.onBrand, fontSize: 15, fontWeight: "700" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(9,8,6,0.6)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: t.colors.surfaceSecondary, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg, padding: 16 },
    modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.borderStrong, marginBottom: 12 },
    modalTitle: { fontSize: 16, fontWeight: "800", color: t.colors.textPrimary, marginBottom: 12 },
    modalSearch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, paddingHorizontal: 12, height: 44, marginBottom: 12 },
    modalSearchInput: { flex: 1, fontSize: 14, color: t.colors.textPrimary },
    motherOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.divider },
    optAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.brandLight, alignItems: "center", justifyContent: "center" },
    optAvatarText: { fontSize: 15, fontWeight: "800", color: t.colors.brandDark },
    optName: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    optSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 1 },
    modalClose: { marginTop: 12, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, paddingVertical: 12, alignItems: "center" },
    modalCloseText: { fontSize: 14, fontWeight: "700", color: t.colors.textSecondary },
  });
