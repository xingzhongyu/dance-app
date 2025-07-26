from demos.utils import try_import
import requests


def get_additional_sweep(entity, project, sweep_id):
    """Recursively retrieve all related sweep IDs from a given sweep.

    Given a sweep ID, this function recursively finds all related sweep IDs by examining
    the command arguments of the runs within each sweep. It handles cases where sweeps
    may have prior runs or additional sweep references.

    """
    wandb = try_import("wandb")
    sweep = wandb.Api().sweep(f"{entity}/{project}/{sweep_id}")
    additional_sweep_ids = [sweep_id]
    #last run command
    run = next((t_run for t_run in sweep.runs if t_run.state == "finished"), None)
    if run is None:  # check summary data count, note aznph5wt, quantities may be inconsistent
        return additional_sweep_ids
    run_id = run.id
    web_abs = requests.get(f"https://api.wandb.ai/files/{run.entity}/{run.project}/{run_id}/wandb-metadata.json")
    args = dict(web_abs.json())["args"]
    for i in range(len(args)):
        if args[i] == '--additional_sweep_ids':
            if i + 1 < len(args):
                additional_sweep_ids += get_additional_sweep(entity=entity, project=project, sweep_id=args[i + 1])
    return additional_sweep_ids
