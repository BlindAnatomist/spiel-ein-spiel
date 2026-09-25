"""Create a durable, self-contained audit checkpoint or final delivery archive."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import sys,json
root=Path(__file__).resolve().parents[1]
target=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent/'EUCHRE_BOT_VALIDATION_REPAIR.zip'
paths=[*root.glob('src/audit/validation*.ts'),root/'src/audit/bots.ts',*root.glob('test/bot-validation*.ts'),*root.glob('scripts/*bot-validation*'),*root.glob('docs/audits/bot-validation/*'),*root.glob('reports/bot-validation/**/*')]
with ZipFile(target,'w',ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(set(paths)):
  if p.is_file() and p.suffix!='.tmp' and p.name!='reconstructed-results.zip':z.write(p,p.relative_to(root))
print(json.dumps({'path':str(target),'bytes':target.stat().st_size,'files':len(paths)}))
