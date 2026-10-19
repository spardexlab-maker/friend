package app.rafiq.personal;
import android.content.Context;
import android.view.View;
import android.graphics.*;
import android.animation.ValueAnimator;
public class VitalRings extends View {
 private final Paint paint=new Paint(3);private final RectF bounds=new RectF();private final ValueAnimator animator;private final float[] values;private final String label;private float progress=0;private final int[] colors={Color.rgb(255,149,74),Color.rgb(255,189,142),Color.rgb(210,210,210)};
 public VitalRings(Context context,float recovery,float sleep,float food){super(context);values=new float[]{recovery,sleep,food};label=recovery<0?"—":String.valueOf(Math.round(recovery))+"%";paint.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));animator=ValueAnimator.ofFloat(0,1);animator.setDuration(450);animator.addUpdateListener(v->{progress=(float)v.getAnimatedValue();invalidate();});animator.start();}
 @Override protected void onDetachedFromWindow(){animator.cancel();super.onDetachedFromWindow();}
 @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);float density=getResources().getDisplayMetrics().density,cx=getWidth()/2f,cy=getHeight()/2f,r=Math.max(0,Math.min(cx,cy)-5*density);paint.setStyle(Paint.Style.STROKE);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeWidth(Math.min(5*density,r*0.14f));
 for(int i=0;i<3;i++){float radius=r*(1-i*0.24f);bounds.set(cx-radius,cy-radius,cx+radius,cy+radius);paint.setColor(Color.rgb(42,42,42));canvas.drawArc(bounds,-90,360,false,paint);paint.setColor(colors[i]);canvas.drawArc(bounds,-90,Math.max(0,Math.min(values[i],100))*3.6f*progress,false,paint);}
 paint.setStyle(Paint.Style.FILL);paint.setColor(Color.WHITE);paint.setTextAlign(Paint.Align.CENTER);paint.setTextSize(Math.min(23*density,r*0.5f));float width=paint.measureText(label);if(width>r*0.8f)paint.setTextSize(paint.getTextSize()*r*0.8f/width);canvas.drawText(label,cx,cy-(paint.ascent()+paint.descent())/2,paint);
 }
}
