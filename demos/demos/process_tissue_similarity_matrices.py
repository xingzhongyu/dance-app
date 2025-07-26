import ast

import numpy as np


def convert_to_complex(s):
    """Convert string representations of complex numbers to float values.

    Parameters
    ----------
    s : str or float
        Input value to convert

    Returns
    -------
    float
        Real part of complex number or NaN if conversion fails

    """
    if isinstance(s, float) or isinstance(s, int):
        return s
    try:
        s = ast.literal_eval(str(s))
        return float(s.real)
    except (ValueError, SyntaxError):
        return np.nan
def convert_complex_value(x):
    """Helper function to convert a single value."""
    if isinstance(x, str):
        try:
            complex_val = complex(x.strip('()'))
            # If imaginary part is close to 0, return real part
            if abs(complex_val.imag) < 1e-10:
                return float(complex_val.real)
            return complex_val
        except ValueError:
            return x
    elif isinstance(x, complex):
        # If imaginary part is close to 0, return real part
        if abs(x.imag) < 1e-10:
            return float(x.real)
        return x
    return x
def unify_complex_float_types_cell(df):
    """Process by cell."""
    for col in df.columns:
        for idx in df.index:
            df.at[idx, col] = convert_complex_value(df.at[idx, col])
    return df