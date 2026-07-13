"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Activity } from "./types";
import { useOrg } from "./org-context";

export function useActivities() {
  const { currentOrgId } = useOrg();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!currentOrgId) {
      setActivities([]);
      return;
    }
    supabase
      .from("activities")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("date", { ascending: false })
      .then(({ data }) => setActivities(data ?? []));
  }, [currentOrgId]);

  return activities;
}
