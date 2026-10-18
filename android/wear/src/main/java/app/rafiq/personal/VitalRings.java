package app.rafiq.personal;
import android.content.Context;
import android.view.View;
import android.graphics.*;
import android.animation.ValueAnimator;
public class VitalRings extends View {
 private final Paint paint=new Paint(3);private float progress=0;private final float recovery,sleep,food;private final int[] colors={Color.rgb(172,243,129),Color.rgb(169,152,255),Color.rgb(110,183,255)};
 public VitalRings(Context context,float recovery,float sleep,float food){super(context);this.recovery=recovery;this.sleep=sleep;this.food=food;ValueAnimator animator=ValueAnimator.ofFloat(0,1);animator.setDuration(900);animator.addUpdateListener(v->{progress=(float)v.getAnimatedValue();invalidate();});animator.start();}
 @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);float cx=getWidth()/2f,cy=getHeight()/2f,r=Math.min(cx,cy)-10;float[] values={recovery,sleep,food};paint.setStyle(Paint.Style.STROKE);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeWidth(7*getResources().getDisplayMetrics().density);
 for(int i=0;i<3;i++){float radius=r-i*14*getResources().getDisplayMetrics().density;RectF bounds=new RectF(cx-radius,cy-radius,cx+radius,cy+radius);paint.setColor(Color.rgb(30,41,52));canvas.drawArc(bounds,-90,360,false,paint);paint.setColor(colors[i]);canvas.drawArc(bounds,-90,Math.max(0,Math.min(values[i],100))*3.6f*progress,false,paint);}
 paint.setStyle(Paint.Style.FILL);paint.setColor(Color.WHITE);paint.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));paint.setTextAlign(Paint.Align.CENTER);paint.setTextSize(23*getResources().getDisplayMetrics().density);canvas.drawText(recovery<0?"—":String.valueOf(Math.round(recovery))+"%",cx,cy+4*getResources().getDisplayMetrics().density,paint);
 }
}
