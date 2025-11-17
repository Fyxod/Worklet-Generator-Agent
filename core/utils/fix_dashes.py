from core.models.worklet import Worklet


def fix_dashes(worklet: Worklet) -> Worklet:
    worklet.title = worklet.title.replace("‑", "-")
    worklet.problem_statement = worklet.problem_statement.replace("‑", "-")
    worklet.description = worklet.description.replace("‑", "-")
    worklet.reasoning = worklet.reasoning.replace("‑", "-")
    worklet.challenge_use_case = worklet.challenge_use_case.replace("‑", "-")
    worklet.deliverables = worklet.deliverables.replace("‑", "-")
    worklet.infrastructure_requirements = worklet.infrastructure_requirements.replace(
        "‑", "-"
    )
    for i, kpi in enumerate(worklet.kpis):
        worklet.kpis[i] = kpi.replace("‑", "-")
    for i, prereq in enumerate(worklet.prerequisites):
        worklet.prerequisites[i] = prereq.replace("‑", "-")
    worklet.tech_stack = worklet.tech_stack.replace("‑", "-")
    for milestone, desc in worklet.milestones.items():
        worklet.milestones[milestone] = desc.replace("‑", "-")

    worklet = fix_unicode(worklet)
    return worklet


def fix_unicode(worklet: Worklet) -> Worklet:
    # fix \u202f (narrow no-break space) to regular space
    worklet.title = worklet.title.replace("\u202f", " ")
    worklet.problem_statement = worklet.problem_statement.replace("\u202f", " ")
    worklet.description = worklet.description.replace("\u202f", " ")
    worklet.reasoning = worklet.reasoning.replace("\u202f", " ")
    worklet.challenge_use_case = worklet.challenge_use_case.replace("\u202f", " ")
    worklet.deliverables = worklet.deliverables.replace("\u202f", " ")
    worklet.infrastructure_requirements = worklet.infrastructure_requirements.replace(
        "\u202f", " "
    )
    for i, kpi in enumerate(worklet.kpis):
        worklet.kpis[i] = kpi.replace("\u202f", " ")
    for i, prereq in enumerate(worklet.prerequisites):
        worklet.prerequisites[i] = prereq.replace("\u202f", " ")
    for milestone, desc in worklet.milestones.items():
        worklet.milestones[milestone] = desc.replace("\u202f", " ")
    return worklet
