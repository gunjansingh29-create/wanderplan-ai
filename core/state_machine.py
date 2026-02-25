"""
WanderPlan AI - Orchestrator State Machine
Tracks the linear planning workflow and enforces valid stage transitions.
"""

from __future__ import annotations

from typing import Optional

from schemas.messages import AgentID, PlanningStage


# ---------------------------------------------------------------------------
# Stage → Agent mapping
# ---------------------------------------------------------------------------

STAGE_AGENT_MAP: dict[PlanningStage, AgentID] = {
    PlanningStage.BUCKET_LIST:  AgentID.BUCKET_LIST,
    PlanningStage.TIMING:       AgentID.TIMING,
    PlanningStage.INTERESTS:    AgentID.INTEREST_PROFILER,
    PlanningStage.HEALTH:       AgentID.HEALTH_ACCESSIBILITY,
    PlanningStage.POIS:         AgentID.POI_DISCOVERY,
    PlanningStage.DURATION:     AgentID.DURATION_OPTIMIZER,
    PlanningStage.AVAILABILITY: AgentID.AVAILABILITY,
    PlanningStage.BUDGET:       AgentID.BUDGET,
    PlanningStage.FLIGHTS:      AgentID.FLIGHT,
    PlanningStage.STAYS:        AgentID.ACCOMMODATION,
    PlanningStage.DINING:       AgentID.DINING,
    PlanningStage.ITINERARY:    AgentID.ITINERARY,
    PlanningStage.CALENDAR:     AgentID.CALENDAR,
}

# Ordered list of stages (the canonical planning sequence)
STAGE_ORDER: list[PlanningStage] = [
    PlanningStage.BUCKET_LIST,
    PlanningStage.TIMING,
    PlanningStage.INTERESTS,
    PlanningStage.HEALTH,
    PlanningStage.POIS,
    PlanningStage.DURATION,
    PlanningStage.AVAILABILITY,
    PlanningStage.BUDGET,
    PlanningStage.FLIGHTS,
    PlanningStage.STAYS,
    PlanningStage.DINING,
    PlanningStage.ITINERARY,
    PlanningStage.CALENDAR,
    PlanningStage.COMPLETED,
]


class PlanningStateMachine:
    """
    Finite-state machine governing the trip planning workflow.

    Transitions are strictly linear by default but support:
      - skip: bypass a stage if data was pre-provided
      - rewind: go back to a previous stage for re-planning
      - retry: re-enter the current stage after an error
    """

    def __init__(self, initial_stage: PlanningStage = PlanningStage.BUCKET_LIST):
        self._current_index: int = STAGE_ORDER.index(initial_stage)
        self._completed_stages: set[PlanningStage] = set()
        self._skipped_stages: set[PlanningStage] = set()
        self._error_count: dict[PlanningStage, int] = {}

    # -- properties ----------------------------------------------------------

    @property
    def current_stage(self) -> PlanningStage:
        return STAGE_ORDER[self._current_index]

    @property
    def is_complete(self) -> bool:
        return self.current_stage == PlanningStage.COMPLETED

    @property
    def progress_pct(self) -> float:
        """Return 0-100 progress based on completed + skipped stages."""
        actionable = len(STAGE_ORDER) - 1   # exclude COMPLETED sentinel
        done = len(self._completed_stages | self._skipped_stages)
        return round((done / actionable) * 100, 1)

    @property
    def responsible_agent(self) -> Optional[AgentID]:
        return STAGE_AGENT_MAP.get(self.current_stage)

    # -- transitions ---------------------------------------------------------

    def advance(self) -> PlanningStage:
        """Mark current stage complete and move to the next."""
        self._completed_stages.add(self.current_stage)
        if self._current_index < len(STAGE_ORDER) - 1:
            self._current_index += 1
        return self.current_stage

    def skip(self) -> PlanningStage:
        """Skip the current stage (data already provided)."""
        self._skipped_stages.add(self.current_stage)
        if self._current_index < len(STAGE_ORDER) - 1:
            self._current_index += 1
        return self.current_stage

    def rewind(self, target: PlanningStage) -> PlanningStage:
        """Go back to a previous stage for re-planning."""
        target_idx = STAGE_ORDER.index(target)
        if target_idx > self._current_index:
            raise ValueError(f"Cannot rewind forward to {target}")
        # Remove completion marks for all stages from target onward
        for stage in STAGE_ORDER[target_idx:self._current_index + 1]:
            self._completed_stages.discard(stage)
            self._skipped_stages.discard(stage)
        self._current_index = target_idx
        return self.current_stage

    def retry(self) -> PlanningStage:
        """Re-enter the current stage after a transient error."""
        stage = self.current_stage
        self._error_count[stage] = self._error_count.get(stage, 0) + 1
        return stage

    def get_error_count(self, stage: Optional[PlanningStage] = None) -> int:
        stage = stage or self.current_stage
        return self._error_count.get(stage, 0)

    # -- serialisation -------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "current_stage": self.current_stage.value,
            "completed": [s.value for s in self._completed_stages],
            "skipped": [s.value for s in self._skipped_stages],
            "errors": {s.value: c for s, c in self._error_count.items()},
            "progress_pct": self.progress_pct,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PlanningStateMachine":
        sm = cls(PlanningStage(data["current_stage"]))
        sm._completed_stages = {PlanningStage(s) for s in data.get("completed", [])}
        sm._skipped_stages = {PlanningStage(s) for s in data.get("skipped", [])}
        sm._error_count = {
            PlanningStage(s): c for s, c in data.get("errors", {}).items()
        }
        return sm
