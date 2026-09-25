"""Materialize the committed reconstruction pack; never replace different evidence."""
from pathlib import Path
import zipfile,hashlib
root=Path(__file__).resolve().parents[1]/'reports/bot-validation'
pack=root/'reconstructed-results.zip'
if not pack.exists():
 print('No result pack present; using already materialized detailed chunks.')
else:
 with zipfile.ZipFile(pack) as z:
  for name in z.namelist():
   p=Path(name)
   if p.parts[0]!='detailed' or p.is_absolute() or '..' in p.parts:raise ValueError('Invalid archived path')
   data=z.read(name);target=root/p
   if target.exists():assert target.read_bytes()==data, f'Conflicting evidence: {p}'
   else:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 print('Verified/materialized',len(z.namelist()),'reconstructed batches')
