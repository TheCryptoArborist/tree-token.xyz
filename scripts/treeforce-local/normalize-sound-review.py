"""Make loudness-matched review clips; does not change in-game mix levels."""
import json, pathlib, re, subprocess, sys
source=pathlib.Path(sys.argv[1])
output=pathlib.Path(sys.argv[2]);output.mkdir(parents=True,exist_ok=True)
def measure(file):
    result=subprocess.run(['ffmpeg','-hide_banner','-i',str(file),'-af','loudnorm=I=-26:TP=-4:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',result.stderr,re.S)[-1])
records=[]
for file in sorted(source.glob('*.wav')):
    m=measure(file)
    filter='loudnorm=I=-26:TP=-4:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}'.format(**m)
    target=output/(file.stem+'.ogg')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(file),'-af',filter,'-ar','44100','-c:a','libvorbis','-q:a','5',str(target)],check=True)
    final=measure(target)
    assert abs(float(final['input_i'])+26)<.6,(file,final)
    assert float(final['input_tp'])<-1.5,(file,final)
    records.append({'name':file.stem,'original':m,'normalized':final})
(output/'loudness.json').write_text(json.dumps(records,indent=2))
print(json.dumps([{'name':r['name'],'LUFS':r['normalized']['input_i'],'truePeakDb':r['normalized']['input_tp']} for r in records],indent=2))
