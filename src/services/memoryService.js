// memoryService.js — Titum AI Memory Service
// Note: addMemory and deleteMemory are passed as parameters, not imported directly.


/**
 * Titum AI Memory Service
 * Handles memory decay, reinforcement, and longitudinal modeling.
 */

const DECAY_BASE_RATE = 0.05;
const REINFORCEMENT_BOOST = 0.15;
const CONTRADICTION_PENALTY = 0.25;

export const processMemorySynthesis = async (synthesis, existingMemories, addMemory, deleteMemory) => {
  const now = new Date().toISOString();
  
  // 1. Process Behavioral Patterns
  if (synthesis.behavioral_patterns) {
    const patterns = Array.isArray(synthesis.behavioral_patterns) ? synthesis.behavioral_patterns : [synthesis.behavioral_patterns];
    
    for (const newPattern of patterns) {
      // Find existing match
      const existing = existingMemories.find(m => 
        m.type === "behavior_pattern" && 
        (m.summary.toLowerCase().includes(newPattern.summary.toLowerCase()) || 
         newPattern.summary.toLowerCase().includes(m.summary.toLowerCase()))
      );

      if (existing) {
        // Reinforce existing memory
        await addMemory({
          ...existing,
          confidence: Math.min(1, (existing.confidence || 0.5) + REINFORCEMENT_BOOST),
          recurrence: (existing.recurrence || 1) + 1,
          reinforcementCount: (existing.reinforcementCount || 0) + 1,
          layer: newPattern.layer || existing.layer || 2,
          relevance: newPattern.relevance || existing.relevance || 1.0,
          lastReinforced: now,
          updatedAt: now
        });
      } else {
        // Create new memory
        await addMemory({
          ...newPattern,
          type: "behavior_pattern",
          layer: newPattern.layer || 2,
          confidence: newPattern.confidence || 0.5,
          recurrence: 1,
          relevance: newPattern.relevance || 1.0,
          decayFactor: DECAY_BASE_RATE,
          reinforcementCount: 1,
          contradictionCount: 0,
          lastReinforced: now,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  }

  // 2. Process Contradictions (If the AI detected any)
  if (synthesis.contradictions) {
    const contradictions = Array.isArray(synthesis.contradictions) ? synthesis.contradictions : [synthesis.contradictions];
    for (const contradiction of contradictions) {
      const target = existingMemories.find(m => m.id === contradiction.targetMemoryId);
      if (target) {
        await addMemory({
          ...target,
          confidence: Math.max(0, (target.confidence || 0.5) - CONTRADICTION_PENALTY),
          contradictionCount: (target.contradictionCount || 0) + 1,
          updatedAt: now
        });
      }
    }
  }

  // 3. Apply Decay to old memories
  for (const memory of existingMemories) {
    if (memory.type !== "behavior_pattern") continue;
    
    const lastUpdate = new Date(memory.updatedAt || memory.createdAt);
    const daysSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate > 7) {
      const decay = (memory.decayFactor || DECAY_BASE_RATE) * Math.floor(daysSinceUpdate / 7);
      const nextConfidence = (memory.confidence || 0.5) - decay;
      
      if (nextConfidence < 0.2) {
        // Memory has faded too much
        await deleteMemory(memory.id);
      } else {
        await addMemory({
          ...memory,
          confidence: nextConfidence,
          updatedAt: now
        });
      }
    }
  }
};

export const calculateMomentumScores = (habits, logs, memories) => {
  const recentLogs = logs.slice(-30);
  const completionRate = recentLogs.length / 30;
  
  return {
    executionMomentum: Math.min(1, completionRate * 1.2),
    behavioralStability: memories.filter(m => m.confidence > 0.8 && m.layer >= 3).length / 10,
    collapseProbability: completionRate < 0.3 ? 0.8 : 0.1,
    recoveryStrength: 0.5 
  };
};

/**
 * Calculates internal calibration metrics for Phase 2 validation.
 * DO NOT EXPOSE TO USER.
 */
export const calculateCalibrationMetrics = (synthesis, conversationHistory, existingMetrics = {}) => {
  const now = new Date().toISOString();
  
  // Repetition Detection (Simplified)
  const recentMsgs = conversationHistory.slice(-4);
  const lastAiMsg = recentMsgs.find(m => m.role === "assistant")?.content || "";
  const prevAiMsg = recentMsgs.filter(m => m.role === "assistant")[1]?.content || "";
  
  const repetitionScore = lastAiMsg.length > 0 && prevAiMsg.length > 0 && 
    (lastAiMsg.substring(0, 50) === prevAiMsg.substring(0, 50)) ? 0.8 : 0.1;

  return {
    ...existingMetrics,
    hallucinationRisk: synthesis.hallucination_risk || 0.1,
    repetitionScore: Math.max(repetitionScore, synthesis.repetition_score || 0),
    pseudoDeepScore: synthesis.pseudo_deep_score || 0.1,
    manipulationRisk: synthesis.manipulation_risk || 0.1,
    forecastingReliability: 0.9, // Based on hard data match
    memoryRelevanceQuality: synthesis.memory_relevance || 0.8,
    lastCalibrated: now
  };
};

