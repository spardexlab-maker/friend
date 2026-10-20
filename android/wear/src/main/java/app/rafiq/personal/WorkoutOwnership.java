package app.rafiq.personal;
import androidx.health.services.client.data.ExerciseInfo;
import androidx.health.services.client.data.ExerciseTrackedStatus;
final class WorkoutOwnership {
 static boolean own(ExerciseInfo info){return info.getExerciseTrackedStatus()==ExerciseTrackedStatus.OWNED_EXERCISE_IN_PROGRESS;}
 static boolean other(ExerciseInfo info){return info.getExerciseTrackedStatus()==ExerciseTrackedStatus.OTHER_APP_IN_PROGRESS;}
}
