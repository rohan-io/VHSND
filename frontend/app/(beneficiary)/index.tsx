import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { LoadError } from "@/src/components/LoadError";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { storage } from "@/src/utils/storage";
import { getPregnancy } from "@/src/api/mch";
import { isTrulyDelivered } from "@/src/utils/pregnancy";
import { shiftISO } from "@/src/utils/date";
import { ANCVisit, PregnancyRecord } from "@/src/types";

type Rating = "good" | "average" | "poor";
const VHSND_FEEDBACK_KEY = "mch_beneficiary_vhsnd_feedback";
const POST_PREGNANCY_FEEDBACK_KEY = "mch_beneficiary_postpregnancy_feedback";

// Mock/sample session list — VHSND has no seeded data model of its own;
// this is illustrative chrome, not a claim about real scheduled sessions.
function mockVhsndSessions() {
  return [
    { id: "vhsnd-next", date: shiftISO(9), upcoming: true },
    { id: "vhsnd-prev-1", date: shiftISO(-21), upcoming: false },
    { id: "vhsnd-prev-2", date: shiftISO(-51), upcoming: false },
  ];
}

/**
 * DEMO/MOCK Beneficiary home screen — a single fixed seeded mother's own view
 * of her care. Deliberately a new, simpler layout (not the Worker/Admin
 * dashboard shell): calmer, less data-dense, built for a mother rather than a
 * trained field worker or official. See demoDb.ts DEMO_BENEFICIARY_USER and
 * AuthContext for how the mock mobile+OTP login resolves to this one account.
 *
 * NOT PRODUCTION-READY: every beneficiary shares this on-device dataset, so a
 * real deployment needs a backend that authenticates a mother and returns only
 * her own records — this demo can only ever point one fixed account at one
 * fixed seeded record.
 */
export default function BeneficiaryHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [pregnancy, setPregnancy] = useState<PregnancyRecord | null>(null);
  const [visits, setVisits] = useState<ANCVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vhsndRating, setVhsndRating] = useState<Rating | null>(null);
  const [vhsndSubmitted, setVhsndSubmitted] = useState(false);
  const [postRating, setPostRating] = useState<Rating | null>(null);
  const [postSubmitted, setPostSubmitted] = useState(false);

  const vhsndSessions = useMemo(mockVhsndSessions, []);

  const load = useCallback(async () => {
    if (!user?.beneficiary_pregnancy_id) {
      setError("No linked record for this account.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [res, savedVhsnd, savedPost] = await Promise.all([
        getPregnancy(user.beneficiary_pregnancy_id),
        storage.getItem<{ rating: Rating } | null>(VHSND_FEEDBACK_KEY, null),
        storage.getItem<{ rating: Rating } | null>(POST_PREGNANCY_FEEDBACK_KEY, null),
      ]);
      setPregnancy(res.pregnancy);
      setVisits(res.visits || []);
      if (savedVhsnd) { setVhsndSubmitted(true); setVhsndRating(savedVhsnd.rating); }
      if (savedPost) { setPostSubmitted(true); setPostRating(savedPost.rating); }
    } catch (e: any) {
      setError(e.message || tr.beneficiary.loadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.beneficiary_pregnancy_id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const submitVhsndFeedback = async () => {
    if (!vhsndRating) { showToast(tr.beneficiary.selectOptionFirst, "error"); return; }
    await storage.setItem(VHSND_FEEDBACK_KEY, { rating: vhsndRating, submitted_at: new Date().toISOString() });
    setVhsndSubmitted(true);
    showToast(tr.beneficiary.feedbackThanks, "success");
  };

  const submitPostPregnancyFeedback = async () => {
    if (!postRating) { showToast(tr.beneficiary.selectOptionFirst, "error"); return; }
    await storage.setItem(POST_PREGNANCY_FEEDBACK_KEY, { rating: postRating, submitted_at: new Date().toISOString() });
    setPostSubmitted(true);
    showToast(tr.beneficiary.postPregnancyThanks, "success");
  };

  const callWorker = (mobile: string) => Linking.openURL(`tel:${mobile}`);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={t.colors.brandSecondary} />
          <Text style={styles.loadingText}>{tr.beneficiary.loading}</Text>
        </View>
      </View>
    );
  }

  if (error || !pregnancy) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LoadError message={error || undefined} onRetry={load} testID="beneficiary-home-error" />
      </View>
    );
  }

  const RATING_OPTIONS: { key: Rating; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "good", label: tr.beneficiary.feedbackGood, icon: "happy-outline" },
    { key: "average", label: tr.beneficiary.feedbackAverage, icon: "remove-circle-outline" },
    { key: "poor", label: tr.beneficiary.feedbackPoor, icon: "sad-outline" },
  ];

  const latestVisit = visits.length
    ? [...visits].sort((a, b) => b.visit_number - a.visit_number)[0]
    : null;
  const delivered = isTrulyDelivered(pregnancy);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Warm, simple identity strip — deliberately not the Worker/Admin Header. */}
      <View style={styles.topBar}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={22} color={t.colors.brandSecondaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{tr.beneficiary.greeting}, {pregnancy.full_name}</Text>
          <Text style={styles.village} numberOfLines={1}>{pregnancy.village}</Text>
        </View>
        <Pressable testID="beneficiary-logout-btn" onPress={handleLogout} style={styles.logoutIconBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={t.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.demoBanner} testID="beneficiary-demo-banner">
        <Ionicons name="flask-outline" size={13} color={t.colors.infoText} />
        <Text style={styles.demoBannerText}>{tr.beneficiary.demoBanner}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.colors.brandSecondary} />}
      >
        {/* 1. VHSND Notifications */}
        <Text style={styles.sectionTitle}>{tr.beneficiary.sectionVhsnd}</Text>
        <View style={styles.card}>
          {vhsndSessions.map((s, i) => (
            <View key={s.id} style={[styles.vhsndRow, i > 0 && styles.rowDivider]}>
              <Ionicons
                name={s.upcoming ? "calendar" : "checkmark-circle-outline"}
                size={18}
                color={s.upcoming ? t.colors.brandSecondaryDark : t.colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.vhsndMsg}>
                  {tr.beneficiary.vhsndMessage.replace("{village}", pregnancy.village)}
                </Text>
                <Text style={styles.vhsndDate}>{s.date}</Text>
              </View>
              <Text style={[styles.vhsndTag, s.upcoming ? styles.tagUpcoming : styles.tagPast]}>
                {s.upcoming ? tr.beneficiary.vhsndUpcomingTag : tr.beneficiary.vhsndPastTag}
              </Text>
            </View>
          ))}
        </View>

        {/* 2. Checkup & Advice */}
        <Text style={styles.sectionTitle}>{tr.beneficiary.sectionCheckups}</Text>
        <View style={styles.card}>
          {visits.length === 0 ? (
            <Text style={styles.emptyText}>{tr.beneficiary.noVisitsYet}</Text>
          ) : (
            [...visits].sort((a, b) => a.visit_number - b.visit_number).map((v, i) => (
              <View key={v.id} testID={`beneficiary-visit-${v.visit_number}`} style={[styles.visitRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.visitTitle}>
                  {tr.beneficiary.visitLabel} #{v.visit_number} • {v.visit_date}
                </Text>
                {v.advice ? (
                  <Text style={styles.visitAdvice}>{tr.beneficiary.adviceLabel} {v.advice}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* 3. Due List */}
        <Text style={styles.sectionTitle}>{tr.beneficiary.sectionDueList}</Text>
        <View style={styles.card}>
          {latestVisit?.next_visit_date ? (
            <View style={styles.dueRow}>
              <Ionicons name="calendar-outline" size={18} color={t.colors.brandSecondaryDark} />
              <Text style={styles.dueLabel}>{tr.beneficiary.nextAncVisit}</Text>
              <Text style={styles.dueValue}>{latestVisit.next_visit_date}</Text>
            </View>
          ) : null}
          {!delivered && pregnancy.edd ? (
            <View style={[styles.dueRow, latestVisit?.next_visit_date && styles.rowDivider]}>
              <Ionicons name="flag-outline" size={18} color={t.colors.brandSecondaryDark} />
              <Text style={styles.dueLabel}>{tr.beneficiary.expectedDelivery}</Text>
              <Text style={styles.dueValue}>{pregnancy.edd}</Text>
            </View>
          ) : null}
          {!latestVisit?.next_visit_date && (delivered || !pregnancy.edd) ? (
            <Text style={styles.emptyText}>{tr.beneficiary.nothingDue}</Text>
          ) : null}
        </View>

        {/* 4. Assigned Worker */}
        <Text style={styles.sectionTitle}>{tr.beneficiary.sectionWorker}</Text>
        <View style={styles.card}>
          {pregnancy.assigned_worker_name ? (
            <Pressable
              testID="beneficiary-call-worker-btn"
              onPress={() => pregnancy.assigned_worker_mobile && callWorker(pregnancy.assigned_worker_mobile)}
              style={styles.workerRow}
            >
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>{pregnancy.assigned_worker_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.workerName}>{pregnancy.assigned_worker_name}</Text>
                {pregnancy.assigned_worker_mobile ? (
                  <Text style={styles.workerContact}>{pregnancy.assigned_worker_mobile} • {tr.beneficiary.callWorker}</Text>
                ) : null}
              </View>
              {pregnancy.assigned_worker_mobile ? (
                <Ionicons name="call" size={20} color={t.colors.brandSecondaryDark} />
              ) : null}
            </Pressable>
          ) : (
            <Text style={styles.emptyText}>{tr.beneficiary.noWorkerAssigned}</Text>
          )}
        </View>

        {/* 5. VHSND feedback */}
        <Text style={styles.sectionTitle}>{tr.beneficiary.sectionVhsndFeedback}</Text>
        <View style={styles.card}>
          {vhsndSubmitted ? (
            <View style={styles.thanksRow}>
              <Ionicons name="checkmark-circle" size={18} color={t.colors.success} />
              <Text style={styles.thanksText}>{tr.beneficiary.feedbackThanks}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.feedbackPrompt}>{tr.beneficiary.feedbackPrompt}</Text>
              <View style={styles.ratingRow}>
                {RATING_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    testID={`beneficiary-vhsnd-rating-${opt.key}`}
                    onPress={() => setVhsndRating(opt.key)}
                    style={[styles.ratingChip, vhsndRating === opt.key && styles.ratingChipActive]}
                  >
                    <Ionicons name={opt.icon} size={20} color={vhsndRating === opt.key ? t.colors.onBrand : t.colors.textSecondary} />
                    <Text style={[styles.ratingChipText, vhsndRating === opt.key && styles.ratingChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable testID="beneficiary-submit-vhsnd-feedback" onPress={submitVhsndFeedback} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>{tr.beneficiary.submitFeedback}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* 6. Post-pregnancy feedback — only once her record is truly delivered. */}
        {delivered && (
          <>
            <Text style={styles.sectionTitle}>{tr.beneficiary.sectionPostPregnancyFeedback}</Text>
            <View style={styles.card} testID="beneficiary-post-pregnancy-feedback">
              {postSubmitted ? (
                <View style={styles.thanksRow}>
                  <Ionicons name="checkmark-circle" size={18} color={t.colors.success} />
                  <Text style={styles.thanksText}>{tr.beneficiary.postPregnancyThanks}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.feedbackPrompt}>{tr.beneficiary.postPregnancyPrompt}</Text>
                  <View style={styles.ratingRow}>
                    {RATING_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.key}
                        testID={`beneficiary-post-rating-${opt.key}`}
                        onPress={() => setPostRating(opt.key)}
                        style={[styles.ratingChip, postRating === opt.key && styles.ratingChipActive]}
                      >
                        <Ionicons name={opt.icon} size={20} color={postRating === opt.key ? t.colors.onBrand : t.colors.textSecondary} />
                        <Text style={[styles.ratingChipText, postRating === opt.key && styles.ratingChipTextActive]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable testID="beneficiary-submit-post-feedback" onPress={submitPostPregnancyFeedback} style={styles.submitBtn}>
                    <Text style={styles.submitBtnText}>{tr.beneficiary.submitPostPregnancyFeedback}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    loadingText: { color: t.colors.textSecondary, fontSize: 13 },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: t.colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.brandSecondaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    greeting: { fontSize: 16, fontWeight: "800", color: t.colors.textPrimary },
    village: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    logoutIconBtn: { padding: 6 },

    demoBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.infoLight,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    demoBannerText: { fontSize: 11, color: t.colors.infoText, flex: 1 },

    scroll: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary, marginTop: 20, marginBottom: 10 },
    card: {
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: "hidden",
      padding: 14,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.divider, marginTop: 10, paddingTop: 10 },
    emptyText: { fontSize: 13, color: t.colors.textMuted, fontStyle: "italic" },

    vhsndRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    vhsndMsg: { fontSize: 13, fontWeight: "600", color: t.colors.textPrimary, lineHeight: 18 },
    vhsndDate: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    vhsndTag: { fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: t.radius.pill, overflow: "hidden" },
    tagUpcoming: { backgroundColor: t.colors.brandSecondaryLight, color: t.colors.brandSecondaryDark },
    tagPast: { backgroundColor: t.colors.surfaceTertiary, color: t.colors.textMuted },

    visitRow: { gap: 4 },
    visitTitle: { fontSize: 13, fontWeight: "700", color: t.colors.textPrimary },
    visitAdvice: { fontSize: 12, color: t.colors.textSecondary, lineHeight: 17 },

    dueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    dueLabel: { flex: 1, fontSize: 13, color: t.colors.textPrimary, fontWeight: "600" },
    dueValue: { fontSize: 13, fontWeight: "800", color: t.colors.brandSecondaryDark },

    workerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    workerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.brandSecondaryLight, alignItems: "center", justifyContent: "center" },
    workerAvatarText: { fontSize: 16, fontWeight: "800", color: t.colors.brandSecondaryDark },
    workerName: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    workerContact: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },

    feedbackPrompt: { fontSize: 13, color: t.colors.textPrimary, fontWeight: "600", marginBottom: 12 },
    ratingRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    ratingChip: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingVertical: 12,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceTertiary,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    ratingChipActive: { backgroundColor: t.colors.brandSecondary, borderColor: t.colors.brandSecondary },
    ratingChipText: { fontSize: 11, fontWeight: "700", color: t.colors.textSecondary },
    ratingChipTextActive: { color: t.colors.onBrand },
    submitBtn: { backgroundColor: t.colors.brandSecondary, borderRadius: t.radius.md, paddingVertical: 13, alignItems: "center" },
    submitBtnText: { color: t.colors.onBrand, fontSize: 13, fontWeight: "800" },

    thanksRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    thanksText: { fontSize: 13, color: t.colors.successText, fontWeight: "700" },
  });
