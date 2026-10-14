"""Read-only verification of the independently reviewed October 11 batch09.

No producer or pack code is imported. Historical UI receipt consistency is checked,
not re-observed. Provider request counts and perceptual acceptance remain unknown.
"""
from pathlib import Path
import array
import hashlib
import json
import math
import re
import subprocess
import sys

PACK_ID = 'peter-euchre-library-batch09-20261011'
PROPOSAL_SHA = '97adc6bd0e4e560ba2aa4b3a79d17b0b83630abf8e4d5fc499dc42eb3051c855'
MANIFEST_SHA = 'a432f2b295956f11473c17f041353243eb30975d6fccd605e3470422bf72c0ef'
ORIGINAL_QA_SHA = 'd53cadad9d2a1e5869f9140e87f27448200fdc73c16731c61e3ce02f34882e0d'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def regular(root, name):
    p = root / name
    require(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(root), 'Unsafe or missing evidence: ' + name)
    return p

def run(args):
    return subprocess.run(args, capture_output=True, check=True, timeout=30)

def main():
    require(sys.flags.isolated and sys.dont_write_bytecode, 'Use python3 -I -B')
    root = Path(sys.argv[1]).resolve()
    proposal_file = Path(sys.argv[2])
    require(proposal_file.is_file() and not proposal_file.is_symlink(), 'Unsafe proposal')
    entries = list(root.rglob('*'))
    require(all(not p.is_symlink() for p in entries), 'Symlink in evidence pack')
    require(all(p.is_file() or p.is_dir() for p in entries), 'Non-regular evidence entry')
    proposal_bytes = proposal_file.read_bytes()
    require(digest(proposal_bytes) == PROPOSAL_SHA, 'Unreviewed batch09 proposal')
    expected_files = {'manifest.json', 'final-qa.json', 'approved-proposal.json', 'sources/original-final-qa.json'}
    for line in json.loads(proposal_bytes)['scripts']:
        expected_files.update({folder + '/' + line['id'] + '.mp3' for folder in ('raw', 'audio')})
    require({str(p.relative_to(root)) for p in entries if p.is_file()} == expected_files, 'Unexpected or missing evidence files')
    require({str(p.relative_to(root)) for p in entries if p.is_dir()} == {'audio', 'raw', 'sources'}, 'Unexpected evidence directories')
    require(regular(root, 'approved-proposal.json').read_bytes() == proposal_bytes, 'Embedded proposal drift')
    manifest_bytes = regular(root, 'manifest.json').read_bytes()
    original_qa_bytes = regular(root, 'sources/original-final-qa.json').read_bytes()
    qa_bytes = regular(root, 'final-qa.json').read_bytes()
    require((digest(proposal_bytes), digest(manifest_bytes), digest(original_qa_bytes)) ==
            (PROPOSAL_SHA, MANIFEST_SHA, ORIGINAL_QA_SHA), 'Unreviewed complete batch09 identity')
    proposal, manifest, original_qa, qa = map(json.loads, [proposal_bytes, manifest_bytes, original_qa_bytes, qa_bytes])
    expected_qa = dict(original_qa, readyCount=24, exactApprovedContractMapping=True,
        audioSummary={'count': 24, 'partial': False, 'rawHashesVerified': True, 'equalDecodedSampleCounts': True},
        derivedImportAdapter={'schemaVersion': 1, 'originalQaSha256': ORIGINAL_QA_SHA,
                             'description': 'Compatibility summary; original evidence unchanged; revalidated on import'})
    require(qa == expected_qa, 'Changed or unlabelled derived QA')
    require(manifest['packId'] == PACK_ID and len(manifest['clips']) == 24, 'Wrong pack')
    before = {str(p.relative_to(root)): digest(p.read_bytes()) for p in root.rglob('*') if p.is_file()}
    raw_hashes, master_hashes, blobs = set(), set(), set()
    for line in proposal['scripts']:
        clip = manifest['clips'][line['id']]
        require(all(clip[k] == line[k] for k in ('id','text','trigger','family','context','direction','deliveryTag')), 'Script mapping drift')
        prompt = '[' + line['deliveryTag'] + '] ' + line['text']
        receipt = clip['browserReceipt']
        require(clip['prompt'] == prompt and clip['payload'] == {'text': prompt, 'temperature': .85, 'reference_id': proposal['reference_id']}, 'Prompt mapping drift')
        require(receipt['id'] == line['id'] and receipt['submittedPrompt'] == prompt and receipt['submittedPromptSha256'] == digest(prompt.encode()), 'Receipt prompt drift')
        require(receipt['attemptNumber'] == 1 and receipt['outcome'] == 'visible-browser-success-exact-MP3-downloaded'
                and receipt['model'] == 's2.1-pro-free' and receipt['temperature'] == .85
                and receipt['reference_id'] == proposal['reference_id']
                and receipt['providerHttpStatus'] is None and receipt['providerRequestCountConfirmed'] is None, 'Receipt provenance drift')
        blob = receipt['downloadHref']
        require(blob.startswith('blob:https://val-voice-lab.netlify.app/') and blob not in blobs, 'Duplicate/invalid browser receipt')
        blobs.add(blob)
        require(all(clip[k] is False for k in ('speechContentVerified','audibleQualityVerified','iphoneVoiceOverVerified')), 'Unsupported perceptual claim')
        counts = []
        for prefix, hashes in [('raw', raw_hashes), ('', master_hashes)]:
            url, sha, size = (clip['rawUrl'], clip['rawSha256'], clip['rawBytes']) if prefix else (clip['url'], clip['sha256'], clip['bytes'])
            require(url == ('raw/' if prefix else 'audio/') + line['id'] + '.mp3', 'Unsafe media mapping')
            p = regular(root, url); data = p.read_bytes()
            require(len(data) == size and digest(data) == sha and sha not in hashes, 'Corrupt or duplicate audio')
            hashes.add(sha)
            info = json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]).stdout)
            require(len(info['streams']) == 1 and info['streams'][0]['codec_name'] == 'mp3'
                    and info['streams'][0]['channels'] == 1 and int(info['streams'][0]['sample_rate']) == 44100, 'Invalid audio format')
            pcm = array.array('f'); pcm.frombytes(run(['ffmpeg','-v','error','-xerror','-i',str(p),'-f','f32le','-acodec','pcm_f32le','-']).stdout)
            if sys.byteorder != 'little': pcm.byteswap()
            require(len(pcm) > 0 and all(math.isfinite(x) for x in pcm), 'Invalid decoded audio')
            counts.append(len(pcm))
            if not prefix:
                require(max(abs(x) for x in pcm) < 1 and sum(x*x for x in pcm)/len(pcm) > 1e-8, 'Clipped or silent master')
                require(abs(float(info['format']['duration']) - clip['durationSeconds']) < .000001, 'Duration drift')
                summary = run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-af','ebur128=peak=true','-f','null','-']).stderr.decode().rsplit('Summary:',1)[-1]
                peak = float(re.search(r'Peak:\s*([-\d.]+) dBFS', summary).group(1))
                require(peak <= -2 and peak == clip['masterMeasurement']['truePeakDbfs'], 'True peak drift')
        require(counts[0] == counts[1] == clip['decodedSampleCount'], 'Changed timing or sample count')
    after = {str(p.relative_to(root)): digest(p.read_bytes()) for p in root.rglob('*') if p.is_file()}
    require(before == after and proposal_file.read_bytes() == proposal_bytes, 'Evidence changed during validation')
    print(json.dumps({'packId': PACK_ID, 'proposalSha256': PROPOSAL_SHA, 'manifestSha256': MANIFEST_SHA,
        'finalQaSha256': digest(qa_bytes), 'originalQaSha256': ORIGINAL_QA_SHA,
        'scriptSha256': digest(Path(__file__).read_bytes()), 'count': 24, 'filesVerified': 48,
        'browserUiReceiptCount': 24, 'historicalUiReobserved': False, 'providerRequestsConfirmed': None,
        'speechContentVerified': False, 'audibleQualityVerified': False, 'listeningAcceptance': False,
        'evidenceBytesUnchanged': True}))

if __name__ == '__main__':
    main()
