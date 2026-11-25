import {createNativeBnbReviewOptions} from './bnb-native-host-options.mjs';
import {mountNativeBnbReview} from './native-bnb-review-mount.mjs';
import {mountBnbProviderPicker} from './bnb-provider-picker.mjs';
// Isolated review candidate only. No global switch or payment capability.
export function PreservedBnbCheckout({React,Native,props,kit,pending,enabled=false}){
 if(!enabled||pending())return React.createElement(Native,props);
 return React.createElement(Review,{React,props,kit});
}
function Review({React,props,kit}){
 const pickerRoot=React.useRef(null),reviewRoot=React.useRef(null),latest=React.useRef(props.session),epoch=React.useRef(0);
 if(latest.current!==props.session){latest.current=props.session;epoch.current++;}
 const [provider,setProvider]=React.useState(null);
 React.useEffect(()=>{const picker=mountBnbProviderPicker({root:pickerRoot.current,onSelected:setProvider});return()=>picker.destroy();},[]);
 React.useEffect(()=>{
  if(!provider)return;
  const options=createNativeBnbReviewOptions({kit,provider,getNativeSession:()=>latest.current,getSessionEpoch:()=>epoch.current,origin:window.location.origin});
  const mount=mountNativeBnbReview({...options,root:reviewRoot.current});return()=>mount.destroy();
 },[provider,kit,props.session]);
 React.useEffect(()=>()=>{epoch.current++;latest.current=null;},[]);
 return React.createElement('section',{'aria-label':'BNB continue review'},React.createElement('p',null,'BNB review only. Payments remain disabled.'),React.createElement('div',{ref:pickerRoot}),React.createElement('div',{ref:reviewRoot}),React.createElement('button',{type:'button',onClick:props.onClose},'Close review'));
}
