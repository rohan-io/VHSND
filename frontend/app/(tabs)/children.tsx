import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { LoadError } from "@/src/components/LoadError";
import { listChildren } from "@/src/api/mch";
import { ChildRecord } from "@/src/types";

export default function ChildrenListScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const FILTERS = [
    { key: "All", label: tr.childrenList.filterAll },
    { key: "Male", label: tr.childrenList.filterBoys },
    { key: "Female", label: tr.childrenList.filterGirls },
  ];
  const [items, setItems] = useState<ChildRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const load = useCallback(async (searchVal: string, filterVal: string) => {
    setLoading(true);
    setError(false);
    try {
      const params: any = {};
      if (searchVal.trim()) params.search = searchVal.trim();
      if (filterVal !== "All") params.gender = filterVal;
      const res = await listChildren(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search, filter);
    }, [filter])
  );

  const renderItem = ({ item }: { item: ChildRecord }) => {
    const st = item.vaccine_stats;
    const pct = st?.progress_percent ?? 0;
    const progressColor = (st?.overdue ?? 0) > 0 ? t.colors.warning : t.colors.success;
    const isFemale = item.gender === "Female";
    return (
      <Pressable
        testID={`child-card-${item.id}`}
        onPress={() => router.push(`/child/${item.id}` as any)}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: isFemale ? t.colors.femaleTint : t.colors.maleTint }]}>
            <Ionicons name={isFemale ? "female" : "male"} size={18} color={isFemale ? t.colors.onFemaleTint : t.colors.onMaleTint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.child_name}</Text>
            <Text style={styles.sub} numberOfLines={2}>{tr.childrenList.careOf} {item.mother_name} • {item.age_label}</Text>
          </View>
          {st && st.overdue > 0 ? (
            <View style={styles.overduePill}>
              <Text style={styles.overdueText}>{st.overdue} {tr.childrenList.overdueSuffix}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: progressColor }]} />
          </View>
          <Text style={styles.progressText}>{st?.completed ?? 0}/{st?.total ?? 0} {tr.childrenList.vaccinesSuffix}</Text>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color={t.colors.textSecondary} />
            <Text style={styles.metaText}>{item.village}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="scale-outline" size={13} color={t.colors.textSecondary} />
            <Text style={styles.metaText}>{item.birth_weight} kg {tr.childrenList.birthWt}</Text>
          </View>
          <Text style={styles.childId}>{item.child_id}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Header title={tr.childrenList.title} showOfflineToggle />

      <View style={styles.stickyHeader}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={t.colors.textMuted} />
          <TextInput
            testID="child-search-input"
            style={styles.searchInput}
            placeholder={tr.childrenList.searchPlaceholder}
            placeholderTextColor={t.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(search, filter)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable testID="child-search-clear" onPress={() => { setSearch(""); load("", filter); }}>
              <Ionicons name="close-circle" size={18} color={t.colors.textMuted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} testID={`child-filter-${f.key}`} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={t.colors.brand} />
        </View>
      ) : error ? (
        <LoadError onRetry={() => load(search, filter)} testID="children-load-error" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.countText}>{total} {tr.childrenList.countRegistered}</Text>}
          ListEmptyComponent={
            search.trim() || filter !== "All" ? (
              <View style={styles.centerFill}>
                <Ionicons name="search-outline" size={40} color={t.colors.textMuted} />
                <Text style={styles.emptyText}>{tr.childrenList.noMatch}</Text>
                <Pressable
                  testID="children-empty-clear"
                  onPress={() => { setSearch(""); setFilter("All"); load("", "All"); }}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>{tr.childrenList.clearFilters}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.centerFill}>
                <Ionicons name="clipboard-outline" size={40} color={t.colors.textMuted} />
                <Text style={styles.emptyText}>{tr.childrenList.noneYet}</Text>
                <Pressable
                  testID="children-empty-register"
                  onPress={() => router.push("/child/register")}
                  style={styles.emptyBtn}
                >
                  <Ionicons name="add" size={16} color={t.colors.onBrand} />
                  <Text style={styles.emptyBtnText}>{tr.childrenList.registerOne}</Text>
                </Pressable>
              </View>
            )
          }
        />
      )}

      <Pressable testID="fab-register-child" onPress={() => router.push("/child/register")} style={styles.fab}>
        <Ionicons name="add" size={26} color={t.colors.onBrand} />
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    stickyHeader: { backgroundColor: t.colors.surfaceSecondary, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, paddingHorizontal: 12, height: 44 },
    searchInput: { flex: 1, fontSize: 14, color: t.colors.textPrimary },
    chipRow: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    chip: { height: 44, flexShrink: 0, justifyContent: "center", paddingHorizontal: 16, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceTertiary, borderWidth: 1, borderColor: t.colors.border },
    chipActive: { backgroundColor: t.colors.brand, borderColor: t.colors.brand },
    chipText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    chipTextActive: { color: t.colors.onBrand },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10, minHeight: 200 },
    emptyText: { fontSize: 13, color: t.colors.textSecondary, textAlign: "center" },
    emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, backgroundColor: t.colors.brand, borderRadius: t.radius.md, paddingHorizontal: 16, paddingVertical: 10 },
    emptyBtnText: { color: t.colors.onBrand, fontSize: 13, fontWeight: "700" },
    listContent: { padding: 16, paddingBottom: 100 },
    countText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary, marginBottom: 10 },
    card: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.colors.border },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    name: { fontSize: 15, fontWeight: "700", color: t.colors.textPrimary },
    sub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 1 },
    overduePill: { backgroundColor: t.colors.errorLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    overdueText: { fontSize: 12, fontWeight: "800", color: t.colors.errorText },
    progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    progressBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceTertiary, overflow: "hidden" },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: t.colors.success },
    progressText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600" },
    childId: { marginLeft: "auto", fontSize: 11, color: t.colors.textMuted, fontWeight: "700" },
    fab: { position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.brand, alignItems: "center", justifyContent: "center", shadowColor: t.colors.brandDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  });
