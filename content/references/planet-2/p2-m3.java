public class Main {
    public static void main(String[] args) {
        if (distanceAhead() == 0) {
            turnRight();
        } else {
            move();
        }
        move();
        move();
        move();
        move();
    }
}
