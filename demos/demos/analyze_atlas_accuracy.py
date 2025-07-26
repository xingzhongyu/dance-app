import yaml


def is_matching_dict(yaml_str, target_dict):
    """Compare YAML configuration with target dictionary.

    Parameters
    ----------
    yaml_str : str
        YAML configuration string to parse
    target_dict : dict
        Target dictionary to compare against

    Returns
    -------
    bool
        True if dictionaries match, False otherwise

    """
    # Parse YAML string
    yaml_config = yaml.safe_load(yaml_str)

    # Build expected dictionary format
    expected_dict = {}
    for i, item in enumerate(yaml_config):
        # Skip misc and graph.cell types, or SCNFeature targets
        if item['type'] in ['misc', 'graph.cell'] or item['target'] == 'SCNFeature':
            continue
        key = f"pipeline.{i}.{item['type']}"
        value = item['target']
        expected_dict[key] = value

    return expected_dict == target_dict