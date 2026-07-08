"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Activity } from "./types";

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    supabase
      .from("activities")
      .select("*")
      .order("date", { ascending: false })
      .then(({ data }) => setActivities(data ?? []));
  }, []);

  return activities;
}
