export type BpCategory = "normal" | "elevated" | "stage_1" | "stage_2" | "severe" | "emergency_symptoms";

export type Advice = {
  category: BpCategory;
  label: string;
  riskLevel: "low" | "watch" | "high" | "urgent";
  summary: string;
  dos: string[];
  donts: string[];
  seekCare: string;
};

const emergencySymptoms = new Set([
  "chest_pain",
  "shortness_of_breath",
  "back_pain",
  "numbness",
  "weakness",
  "vision_changes",
  "difficulty_speaking"
]);

export function classifyBloodPressure(systolic: number, diastolic: number, symptoms: string[] = []): Advice {
  const hasEmergencySymptom = symptoms.some((symptom) => emergencySymptoms.has(symptom));

  if ((systolic > 180 || diastolic > 120) && hasEmergencySymptom) {
    return {
      category: "emergency_symptoms",
      label: "Possible hypertensive emergency",
      riskLevel: "urgent",
      summary: "This reading is very high and you reported symptoms that need emergency medical evaluation.",
      dos: ["Call emergency services now.", "Keep the reading and symptom details available for responders."],
      donts: ["Do not wait to see whether the reading comes down on its own.", "Do not drive yourself if you feel unwell."],
      seekCare: "Call emergency services immediately."
    };
  }

  if (systolic > 180 || diastolic > 120) {
    return {
      category: "severe",
      label: "Severe range",
      riskLevel: "urgent",
      summary: "This reading is in a very high range. Rest quietly, repeat the reading, and contact a healthcare professional promptly if it remains high.",
      dos: ["Sit quietly and recheck using correct technique.", "Contact your healthcare professional immediately if the second reading is still very high."],
      donts: ["Do not change or stop medication unless your clinician tells you to.", "Do not ignore new symptoms."],
      seekCare: "Seek same-day medical guidance. Call emergency services if symptoms such as chest pain, shortness of breath, weakness, vision changes, or difficulty speaking appear."
    };
  }

  if (systolic >= 140 || diastolic >= 90) {
    return {
      category: "stage_2",
      label: "Stage 2 hypertension range",
      riskLevel: "high",
      summary: "This reading is in a high blood pressure range and should be tracked closely, especially if it repeats.",
      dos: ["Repeat the reading after resting if this is unexpected.", "Log possible triggers such as stress, caffeine, salty food, pain, or missed medication.", "Share repeated high readings with your healthcare professional."],
      donts: ["Do not skip prescribed medication.", "Do not use this app to adjust medication doses."],
      seekCare: "Contact your healthcare professional if readings stay in this range or are increasing."
    };
  }

  if (systolic >= 130 || diastolic >= 80) {
    return {
      category: "stage_1",
      label: "Stage 1 hypertension range",
      riskLevel: "watch",
      summary: "This reading is above the normal range. Patterns over time matter more than one isolated reading.",
      dos: ["Keep measuring at consistent times.", "Prioritize low-salt meals, regular walking, sleep, and stress management.", "Bring your log to your next appointment."],
      donts: ["Do not dismiss repeated readings in this range.", "Do not rely on a single reading to judge control."],
      seekCare: "Discuss repeated readings in this range with your healthcare professional."
    };
  }

  if (systolic >= 120 && diastolic < 80) {
    return {
      category: "elevated",
      label: "Elevated range",
      riskLevel: "watch",
      summary: "Your systolic reading is elevated. This is a useful moment to strengthen prevention habits.",
      dos: ["Continue routine monitoring.", "Reduce sodium, stay active, and watch caffeine or alcohol triggers."],
      donts: ["Do not assume elevated readings are harmless if they become frequent."],
      seekCare: "Review your trend with a clinician during routine care."
    };
  }

  return {
    category: "normal",
    label: "Normal range",
    riskLevel: "low",
    summary: "This reading is in the normal range.",
    dos: ["Keep logging consistently.", "Maintain prescribed medication and healthy routines."],
    donts: ["Do not stop prescribed medication because of one normal reading."],
    seekCare: "Continue regular follow-up as recommended by your healthcare professional."
  };
}
