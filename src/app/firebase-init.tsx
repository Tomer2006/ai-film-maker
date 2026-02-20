"use client";

import { useEffect } from "react";

import { initFirebaseAnalytics } from "@/lib/firebase-client";

export default function FirebaseInit() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  return null;
}
