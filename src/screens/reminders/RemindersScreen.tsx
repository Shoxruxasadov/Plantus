import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, CaretRight } from "phosphor-react-native";

import { RootStackParamList, Plant } from "../../types";
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  PLACEHOLDER_IMAGE,
} from "../../utils/theme";
import { useTheme } from "../../hooks";
import { useAppStore } from "../../store/appStore";
import { useTranslation } from "../../i18n";
import { getGardenPlants, updateGardenPlant } from "../../services/supabase";
import { hasTaskDueToday } from "../../utils/helpers";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CARE_PLAN_KEYS = ["Watering", "Fertilize", "Repotting", "Pruning", "Humidity", "Soilcheck"];

// ---- Care plan icons ----
const CARE_ICONS: Record<string, any> = {
  Watering: require("../../../assets/images/Careplan1.png"),
  Fertilize: require("../../../assets/images/Careplan2.png"),
  Repotting: require("../../../assets/images/Careplan3.png"),
  Pruning: require("../../../assets/images/Careplan4.png"),
  Humidity: require("../../../assets/images/Careplan5.png"),
  Soilcheck: require("../../../assets/images/Careplan6.png"),
};

// ---- Helpers ----
function safeParse(val: any) {
  if (!val) return null;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return val;
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get today's journal entry for a task */
function getTodayJournal(journals: any[], taskKey: string): any | null {
  const today = todayStart();
  return (
    journals.find((j) => {
      const task = j.Task || j.task;
      if (task !== taskKey) return false;
      const time = j.Time || j.time;
      if (!time) return false;
      return isSameDay(new Date(time), today);
    }) || null
  );
}

// ---- Types ----
interface PlantWithTasks {
  id: string;
  name: string;
  image: string;
  tasks: {
    key: string;
    label: string;
    status: "pending" | "Done" | "Skipped";
  }[];
  journals: any[];
  rawPlant: any;
}

export default function RemindersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userCollection, isLoggedIn } = useAppStore();

  const getCareLabel = (key: string) => {
    const map: Record<string, string> = {
      Watering: t("garden.careWatering"),
      Fertilize: t("garden.careFertilize"),
      Repotting: t("garden.careRepotting"),
      Pruning: t("garden.carePruning"),
      Humidity: t("garden.careHumidity"),
      Soilcheck: t("garden.careSoilCheck"),
    };
    return map[key] ?? key;
  };

  const [plants, setPlants] = useState<PlantWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!isLoggedIn || !userCollection.id) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getGardenPlants(userCollection.id);
      if (!data) {
        setPlants([]);
        return;
      }

      const result: PlantWithTasks[] = [];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0); // midday yesterday for timestamp

      for (const plant of data) {
        const cp = safeParse(plant.customcareplan) || safeParse(plant.careplan);
        if (!cp || typeof cp !== "object") continue;

        let journals: any[] = [];
        if (plant.journals) {
          if (Array.isArray(plant.journals)) {
            journals = plant.journals
              .map((j: any) => (typeof j === "string" ? safeParse(j) : j))
              .filter(Boolean);
          } else {
            const parsed = safeParse(plant.journals);
            if (Array.isArray(parsed)) journals = parsed;
          }
        }

        // ---- Auto-Skipped: check yesterday ----
        let journalsUpdated = false;
        for (const careKey of CARE_PLAN_KEYS) {
          const item =
            cp[careKey] ||
            cp[careKey.charAt(0).toLowerCase() + careKey.slice(1)];
          if (!item) continue;
          if (item.NotificationEnabled === false || item.notificationEnabled === false) continue;

          const repeat = item.Repeat || item.repeat;
          if (!repeat || repeat === "NotSet") continue;

          // Check if there's any journal entry for this task yesterday
          const yStart = new Date(yesterday);
          yStart.setHours(0, 0, 0, 0);
          const hasYesterday = journals.some((j) => {
            const task = j.Task || j.task;
            if (task !== careKey) return false;
            const time = j.Time || j.time;
            if (!time) return false;
            return isSameDay(new Date(time), yStart);
          });

          if (!hasYesterday) {
            // Add skipped entry for yesterday
            journals.push({
              Task: careKey,
              Time: yesterday.getTime(),
              Status: "Skipped",
            });
            journalsUpdated = true;
          }
        }

        // Save skipped entries to Supabase if any were added
        if (journalsUpdated) {
          try {
            await updateGardenPlant(String(plant.id), { journals });
          } catch (e) {
            console.error("[Reminders] Skipped save error:", e);
          }
        }

        // ---- Build today's task list ----
        const tasks: PlantWithTasks["tasks"] = [];

        for (const careKey of CARE_PLAN_KEYS) {
          const item =
            cp[careKey] ||
            cp[careKey.charAt(0).toLowerCase() + careKey.slice(1)];
          if (!item) continue;
          if (!hasTaskDueToday(cp, careKey)) continue;

          const todayEntry = getTodayJournal(journals, careKey);
          let status: "pending" | "Done" | "Skipped" = "pending";
          if (todayEntry) {
            status =
              (todayEntry.Status || todayEntry.status) === "Done"
                ? "Done"
                : "Skipped";
          }

          tasks.push({
            key: careKey,
            label: getCareLabel(careKey),
            status,
          });
        }

        if (tasks.length === 0) continue;

        const images = plant.images || [];
        result.push({
          id: String(plant.id),
          name: plant.name || "Unknown Plant",
          image: images.length > 0 ? images[0] : PLACEHOLDER_IMAGE,
          tasks,
          journals,
          rawPlant: plant,
        });
      }

      setPlants(result);
    } catch (error) {
      console.error("[Reminders] Load error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, userCollection.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---- Toggle task status ----
  const handleToggleTask = (
    plantIndex: number,
    taskKey: string,
    currentStatus: string,
  ) => {
    const plant = plants[plantIndex];
    if (!plant) return;

    if (currentStatus === "Done") {
      // Already done - ask to undo
      Alert.alert(
        t("garden.alertUndoTask"),
        t("garden.alertRemoveFromCompleted", { name: getCareLabel(taskKey) }),
        [
          { text: t("garden.cancel"), style: "cancel" },
          {
            text: t("garden.undo"),
            onPress: () => updateJournal(plantIndex, taskKey, null),
          },
        ],
      );
    } else {
      Alert.alert(
        t("garden.alertCompleteTask"),
        t("garden.alertMarkDone", { name: getCareLabel(taskKey) }),
        [
          { text: t("garden.cancel"), style: "cancel" },
          {
            text: t("garden.yes"),
            onPress: () => updateJournal(plantIndex, taskKey, "Done"),
          },
        ],
      );
    }
  };

  // ---- Update journal in Supabase ----
  const updateJournal = async (
    plantIndex: number,
    taskKey: string,
    status: string | null,
  ) => {
    const plant = plants[plantIndex];
    if (!plant) return;

    try {
      const today = todayStart();
      let journals = [...plant.journals];

      // Remove today's entry for this task if exists
      journals = journals.filter((j) => {
        const task = j.Task || j.task;
        if (task !== taskKey) return true;
        const time = j.Time || j.time;
        if (!time) return true;
        return !isSameDay(new Date(time), today);
      });

      // Add new entry if status provided
      if (status) {
        journals.push({
          Task: taskKey,
          Time: Date.now(),
          Status: status,
        });
      }

      // Save to Supabase
      await updateGardenPlant(plant.id, {
        journals: journals,
      });

      // Update local state
      setPlants((prev) => {
        const copy = [...prev];
        copy[plantIndex] = {
          ...copy[plantIndex],
          journals,
          tasks: copy[plantIndex].tasks.map((t) => {
            if (t.key !== taskKey) return t;
            return {
              ...t,
              status:
                status === "Done"
                  ? "Done"
                  : status === "Skipped"
                    ? "Skipped"
                    : "pending",
            };
          }),
        };
        return copy;
      });
    } catch (error) {
      console.error("[Reminders] Update error:", error);
      Alert.alert(t("common.error"), t("garden.errorUpdateTask"));
    }
  };

  const getCompletedCount = (tasks: PlantWithTasks["tasks"]) => {
    return tasks.filter((t) => t.status === "Done").length;
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{t("reminders.title")}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.textSecondary} />
        </View>
      ) : plants.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: theme.text }]}>
            {t("reminders.noActive")}
          </Text>
          <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            {t("reminders.noActiveHint")}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {plants.map((plant, plantIdx) => {
            const completed = getCompletedCount(plant.tasks);
            return (
              <View
                key={plant.id}
                style={[
                  styles.plantCard,
                  { backgroundColor: theme.background },
                ]}
              >
                {/* Plant header */}
                <TouchableOpacity
                  style={styles.plantHeader}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate("Plant", {
                      plantId: plant.rawPlant?.id,
                      isGarden: true,
                      snap: plant.rawPlant,
                    })
                  }
                >
                  <Image
                    source={{ uri: plant.image }}
                    style={styles.plantImg}
                    resizeMode="cover"
                  />
                  <View style={styles.plantInfo}>
                    <Text style={[styles.plantName, { color: theme.text }]}>
                      {plant.name}
                    </Text>
                    <Text
                      style={[
                        styles.plantProgress,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {completed} of {plant.tasks.length} completed
                    </Text>
                  </View>
                  <CaretRight size={18} color={theme.textSecondary} weight="bold"/>
                </TouchableOpacity>

                {/* Tasks */}
                {plant.tasks.map((task, index) => (
                  <TouchableOpacity
                    key={task.key}
                    style={[
                      styles.taskRow,
                      {
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: theme.accent3,
                      },
                    ]}
                    onPress={() =>
                      handleToggleTask(plantIdx, task.key, task.status)
                    }
                    activeOpacity={0.7}
                  >
                    <Image
                      source={CARE_ICONS[task.key]}
                      style={styles.taskIcon}
                      resizeMode="contain"
                    />
                    <Text
                      style={[
                        styles.taskLabel,
                        { color: theme.text },
                        task.status === "Done" && styles.taskLabelDone,
                      ]}
                    >
                      {task.label}
                    </Text>

                    <View
                      style={[
                        styles.checkbox,
                        task.status !== "Done" &&
                          task.status !== "Skipped" && {
                            borderColor: theme.borderLight,
                          },
                        task.status === "Done" && styles.checkboxDone,
                        task.status === "Skipped" && styles.checkboxSkipped,
                      ]}
                    >
                      {task.status === "Done" && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                      {task.status === "Skipped" && (
                        <Text style={styles.skippedMark}>–</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: FONT_SIZES.xl, fontWeight: "700", color: COLORS.text },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },

  // Plant card
  plantCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 4,
    marginBottom: SPACING.lg,
  },
  plantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  plantImg: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    marginRight: SPACING.md,
  },
  plantInfo: { flex: 1 },
  plantName: { fontSize: FONT_SIZES.lg, fontWeight: "700", color: COLORS.text },
  plantProgress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Task row
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md + 2,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  taskIcon: {
    width: 40,
    height: 40,
    marginRight: SPACING.md,
  },
  taskLabel: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: "500",
    color: COLORS.text,
  },
  taskLabelDone: {
    color: COLORS.textSecondary,
  },

  // Checkbox
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D3D5D9",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxSkipped: {
    backgroundColor: "#FAC515",
    borderColor: "#FAC515",
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  skippedMark: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
